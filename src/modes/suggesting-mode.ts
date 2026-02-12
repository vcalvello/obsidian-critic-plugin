import { EditorState, Transaction, TransactionSpec } from "@codemirror/state";
import { CriticType } from "../types";
import { criticRangesField } from "../editor/state";
import { createAddition, createDeletion, createSubstitution } from "../parser/critic-parser";

/**
 * Check if a position is inside an existing addition created by the same author.
 * Returns the CriticRange if found, undefined otherwise.
 *
 * "Inside" means the cursor is between the opening delimiter+metadata and closing delimiter,
 * i.e., within the user-visible content area of an addition.
 */
function findOwnAdditionAtPos(state: EditorState, pos: number, author: string) {
  const ranges = state.field(criticRangesField);
  for (const range of ranges) {
    if (range.type !== CriticType.ADDITION) continue;
    if (range.metadata?.author !== author) continue;

    // Calculate the content boundaries within the raw document
    const metaSepIdx = range.rawContent.indexOf("@@");
    const metaPrefixLen = metaSepIdx >= 0 ? metaSepIdx + 2 : 0;
    const contentStart = range.from + 3 + metaPrefixLen; // 3 = {++
    const contentEnd = contentStart + range.content.length;

    // Cursor is inside the visible content area (inclusive of edges for appending)
    if (pos >= contentStart && pos <= contentEnd) {
      return { range, contentStart, contentEnd };
    }
  }
  return undefined;
}

/**
 * Check if a position is inside an existing deletion created by the same author.
 */
function findOwnDeletionAtPos(state: EditorState, pos: number, author: string) {
  const ranges = state.field(criticRangesField);
  for (const range of ranges) {
    if (range.type !== CriticType.DELETION) continue;
    if (range.metadata?.author !== author) continue;

    const metaSepIdx = range.rawContent.indexOf("@@");
    const metaPrefixLen = metaSepIdx >= 0 ? metaSepIdx + 2 : 0;
    const contentStart = range.from + 3 + metaPrefixLen;
    const contentEnd = contentStart + range.content.length;

    if (pos >= contentStart && pos <= contentEnd) {
      return { range, contentStart, contentEnd };
    }
  }
  return undefined;
}

/**
 * Transaction filter for Suggesting mode.
 * Intercepts user edits and wraps them in CriticMarkup.
 */
export function suggestingModeFilter(author: string) {
  return EditorState.transactionFilter.of((tr: Transaction) => {
    // Only intercept transactions that change the document
    if (!tr.docChanged) return tr;

    // Only intercept user-initiated events
    const userEvent = tr.annotation(Transaction.userEvent);
    if (!userEvent) return tr;

    // Only intercept input, delete, and paste events
    const isInput = userEvent.startsWith("input");
    const isDelete = userEvent.startsWith("delete");
    const isPaste = userEvent.startsWith("input.paste");
    const isMove = userEvent.startsWith("move");

    if (!isInput && !isDelete && !isPaste && !isMove) return tr;

    // Collect all changes
    const changes: { fromA: number; toA: number; inserted: string }[] = [];
    tr.changes.iterChanges((fromA, toA, fromB, toB, inserted) => {
      changes.push({ fromA, toA, inserted: inserted.toString() });
    });

    if (changes.length === 0) return tr;

    // Process each change and build replacement specs
    const specs: TransactionSpec[] = [];
    let offset = 0;

    for (const change of changes) {
      const { fromA, toA, inserted } = change;
      const deletedText = tr.startState.doc.sliceString(fromA, toA);
      const hasInsertion = inserted.length > 0;
      const hasDeletion = deletedText.length > 0;

      // Check if we're inside our own addition (consecutive typing)
      if (hasInsertion && !hasDeletion) {
        const ownAddition = findOwnAdditionAtPos(tr.startState, fromA, author);
        if (ownAddition) {
          // Let the edit pass through directly - extending existing addition
          return tr;
        }
      }

      // Check if we're backspacing inside our own addition (shrinking)
      if (hasDeletion && !hasInsertion) {
        const ownAddition = findOwnAdditionAtPos(tr.startState, fromA, author);
        if (ownAddition && fromA >= ownAddition.contentStart && toA <= ownAddition.contentEnd) {
          // Let the edit pass through - shrinking existing addition
          return tr;
        }
      }

      // Check if we're inside our own deletion (extending)
      if (hasDeletion && !hasInsertion) {
        const ownDeletion = findOwnDeletionAtPos(tr.startState, fromA, author);
        if (ownDeletion) {
          // Already inside own deletion, let it pass through
          return tr;
        }
      }

      let replacement: string;
      let cursorOffset: number;

      if (hasInsertion && hasDeletion) {
        // Replacement: create substitution
        replacement = createSubstitution(deletedText, inserted, author);
        // Position cursor after the new text, before ~~}
        cursorOffset = replacement.length - 3; // before ~~}
      } else if (hasInsertion) {
        // Pure insertion: create addition
        replacement = createAddition(inserted, author);
        // Position cursor after the inserted text, before ++}
        cursorOffset = replacement.length - 3; // before ++}
      } else {
        // Pure deletion: wrap deleted text in deletion markup
        replacement = createDeletion(deletedText, author);
        // Position cursor after the deletion markup
        cursorOffset = replacement.length;
      }

      specs.push({
        changes: {
          from: fromA + offset,
          to: toA + offset,
          insert: replacement,
        },
        selection: {
          anchor: fromA + offset + cursorOffset,
        },
      });

      // Track offset shift for multiple changes
      offset += replacement.length - (toA - fromA);
    }

    if (specs.length === 0) return tr;

    // Build a single transaction with all changes
    // Use filter: false to avoid recursive interception
    const spec = specs[0];
    return tr.startState.update({
      ...spec,
      annotations: Transaction.userEvent.of("critic.suggest"),
    });
  });
}
