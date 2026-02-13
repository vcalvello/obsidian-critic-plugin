import { EditorView } from "@codemirror/view";
import { Transaction } from "@codemirror/state";
import { CriticRange } from "../types";
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
