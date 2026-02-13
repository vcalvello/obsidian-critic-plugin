import { EditorView } from "@codemirror/view";
import { Transaction } from "@codemirror/state";
import { CriticRange, CriticType } from "../types";
import { criticRangesField } from "../editor/state";
import { updateMetadataInRange } from "../parser/critic-parser";

/**
 * Resolve a comment by setting its status to "resolved" in the metadata.
 */
export function resolveComment(view: EditorView, range: CriticRange): void {
  if (!range.metadata) return;
  const change = updateMetadataInRange(range, { status: "resolved" });
  view.dispatch({
    changes: change,
    annotations: Transaction.userEvent.of("critic.comment.resolve"),
  });
}

/**
 * Re-open a resolved comment by setting its status back to "open".
 */
export function reopenComment(view: EditorView, range: CriticRange): void {
  if (!range.metadata) return;
  const change = updateMetadataInRange(range, { status: "open" });
  view.dispatch({
    changes: change,
    annotations: Transaction.userEvent.of("critic.comment.reopen"),
  });
}

/**
 * Resolve all open comments in the document.
 * Filters for root COMMENT ranges (no replyTo) with status !== "resolved",
 * then processes in reverse order to maintain positions.
 */
export function resolveAllComments(view: EditorView): void {
  const ranges = view.state.field(criticRangesField);
  const openComments = ranges.filter(
    (r) =>
      r.type === CriticType.COMMENT &&
      r.metadata &&
      !r.metadata.replyTo &&
      r.metadata.status !== "resolved"
  );

  if (openComments.length === 0) return;

  const changes = [...openComments]
    .reverse()
    .map((r) => updateMetadataInRange(r, { status: "resolved" }));

  view.dispatch({
    changes,
    annotations: Transaction.userEvent.of("critic.comment.resolve-all"),
  });
}
