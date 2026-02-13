import { EditorView } from "@codemirror/view";
import { Transaction } from "@codemirror/state";
import { CriticRange, CriticType } from "../types";
import { createComment, createHighlight, generateId, serializeMetadata } from "../parser/critic-parser";
import { criticRangesField } from "../editor/state";
import { setFocusedCommentEffect } from "../editor/focused-comment";

/**
 * Add a comment on the current selection.
 * Wraps selected text in {==sel==}{>>meta@@<<} and returns the comment ID.
 * If nothing is selected, inserts an unanchored comment at the cursor.
 */
export function addComment(view: EditorView, author: string): string {
  const { from, to } = view.state.selection.main;
  const commentId = generateId();
  const meta = serializeMetadata({
    id: commentId,
    author,
    time: Math.floor(Date.now() / 1000),
  });

  let insert: string;
  let replaceFrom: number;
  let replaceTo: number;

  if (from < to) {
    // Selection exists: wrap in highlight + empty comment
    const selectedText = view.state.sliceDoc(from, to);
    insert = createHighlight(selectedText) + `{>>${meta}<<}`;
    replaceFrom = from;
    replaceTo = to;
  } else {
    // No selection: insert unanchored comment at cursor
    insert = `{>>${meta}<<}`;
    replaceFrom = from;
    replaceTo = from;
  }

  view.dispatch({
    changes: { from: replaceFrom, to: replaceTo, insert },
    annotations: Transaction.userEvent.of("critic.comment"),
    effects: setFocusedCommentEffect.of(commentId),
  });

  return commentId;
}

/**
 * Save text into an empty comment (the one just created).
 * Finds the comment by ID, inserts text between @@ and <<}.
 */
export function saveCommentText(view: EditorView, commentId: string, text: string): void {
  const ranges = view.state.field(criticRangesField);
  const range = ranges.find(
    (r) => r.type === CriticType.COMMENT && r.metadata?.id === commentId
  );
  if (!range) return;

  // Find position after @@ in the raw comment
  const docText = view.state.sliceDoc(range.from, range.to);
  const sepIdx = docText.indexOf("@@");
  if (sepIdx === -1) return;

  const insertPos = range.from + sepIdx + 2; // after @@
  // The current content sits between @@ and <<}
  const closeIdx = docText.lastIndexOf("<<}");
  const currentContentEnd = range.from + closeIdx;

  view.dispatch({
    changes: { from: insertPos, to: currentContentEnd, insert: text },
    annotations: Transaction.userEvent.of("critic.comment.save"),
  });
}

/**
 * Cancel an empty comment (remove highlight + comment markup, restore original text).
 */
export function cancelEmptyComment(view: EditorView, commentId: string): void {
  const ranges = view.state.field(criticRangesField);
  const commentRange = ranges.find(
    (r) => r.type === CriticType.COMMENT && r.metadata?.id === commentId
  );
  if (!commentRange) return;

  // Check if there's an anchor highlight immediately before this comment
  const anchorRange = ranges.find(
    (r) => r.type === CriticType.HIGHLIGHT && r.to === commentRange.from
  );

  const changes: { from: number; to: number; insert: string }[] = [];

  if (anchorRange) {
    // Remove both highlight + comment, restore the highlighted text
    changes.push({
      from: anchorRange.from,
      to: commentRange.to,
      insert: anchorRange.content,
    });
  } else {
    // No anchor, just remove the comment
    changes.push({
      from: commentRange.from,
      to: commentRange.to,
      insert: "",
    });
  }

  view.dispatch({
    changes,
    annotations: Transaction.userEvent.of("critic.comment.cancel"),
    effects: setFocusedCommentEffect.of(null),
  });
}

/**
 * Add a reply to an existing comment thread.
 * Inserts {>>meta@@text<<} with replyTo after the last range of the thread.
 */
export function addReply(
  view: EditorView,
  parentId: string,
  text: string,
  author: string
): void {
  const ranges = view.state.field(criticRangesField);

  // Find all ranges in this thread (root + replies)
  const threadRanges = ranges.filter(
    (r) =>
      r.type === CriticType.COMMENT &&
      (r.metadata?.id === parentId || r.metadata?.replyTo === parentId)
  );

  if (threadRanges.length === 0) return;

  // Insert after the last range in the thread
  const lastRange = threadRanges[threadRanges.length - 1];
  const reply = createComment(text, author, parentId);

  view.dispatch({
    changes: { from: lastRange.to, to: lastRange.to, insert: reply },
    annotations: Transaction.userEvent.of("critic.comment.reply"),
  });
}
