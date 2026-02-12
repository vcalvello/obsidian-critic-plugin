import { EditorState, Transaction } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { CriticRange, CriticType } from "../types";
import { criticRangesField } from "../editor/state";

/**
 * Get the text that should remain after accepting a suggestion.
 */
function getAcceptText(range: CriticRange): string {
  switch (range.type) {
    case CriticType.ADDITION:
      return range.content;
    case CriticType.DELETION:
      return "";
    case CriticType.SUBSTITUTION:
      return range.newContent ?? "";
    default:
      return "";
  }
}

/**
 * Get the text that should remain after rejecting a suggestion.
 */
function getRejectText(range: CriticRange): string {
  switch (range.type) {
    case CriticType.ADDITION:
      return "";
    case CriticType.DELETION:
      return range.content;
    case CriticType.SUBSTITUTION:
      return range.oldContent ?? "";
    default:
      return "";
  }
}

/**
 * Check if a CriticRange is a suggestion (not a comment or highlight).
 */
function isSuggestion(range: CriticRange): boolean {
  return (
    range.type === CriticType.ADDITION ||
    range.type === CriticType.DELETION ||
    range.type === CriticType.SUBSTITUTION
  );
}

/**
 * Find the suggestion range at the current cursor position.
 */
export function findSuggestionAtCursor(state: EditorState): CriticRange | undefined {
  const ranges = state.field(criticRangesField);
  const cursor = state.selection.main.head;

  for (const range of ranges) {
    if (!isSuggestion(range)) continue;
    if (cursor >= range.from && cursor <= range.to) {
      return range;
    }
  }
  return undefined;
}

/**
 * Accept a single suggestion: replace the markup with the accepted text.
 */
export function acceptSuggestion(view: EditorView, range: CriticRange): void {
  const replacement = getAcceptText(range);
  view.dispatch({
    changes: { from: range.from, to: range.to, insert: replacement },
    annotations: Transaction.userEvent.of("critic.accept"),
  });
}

/**
 * Reject a single suggestion: replace the markup with the rejected text.
 */
export function rejectSuggestion(view: EditorView, range: CriticRange): void {
  const replacement = getRejectText(range);
  view.dispatch({
    changes: { from: range.from, to: range.to, insert: replacement },
    annotations: Transaction.userEvent.of("critic.reject"),
  });
}

/**
 * Accept all suggestions in the document.
 * Process in reverse order to maintain correct positions.
 */
export function acceptAllSuggestions(view: EditorView): void {
  const ranges = view.state.field(criticRangesField);
  const suggestions = ranges.filter(isSuggestion);

  if (suggestions.length === 0) return;

  // Process in reverse order
  const changes = [...suggestions]
    .reverse()
    .map((range) => ({
      from: range.from,
      to: range.to,
      insert: getAcceptText(range),
    }));

  view.dispatch({
    changes,
    annotations: Transaction.userEvent.of("critic.accept-all"),
  });
}

/**
 * Reject all suggestions in the document.
 * Process in reverse order to maintain correct positions.
 */
export function rejectAllSuggestions(view: EditorView): void {
  const ranges = view.state.field(criticRangesField);
  const suggestions = ranges.filter(isSuggestion);

  if (suggestions.length === 0) return;

  // Process in reverse order
  const changes = [...suggestions]
    .reverse()
    .map((range) => ({
      from: range.from,
      to: range.to,
      insert: getRejectText(range),
    }));

  view.dispatch({
    changes,
    annotations: Transaction.userEvent.of("critic.reject-all"),
  });
}
