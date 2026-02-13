import { Transaction } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { CriticRange, CriticType } from "../types";
import { criticRangesField } from "../editor/state";

/**
 * Get the replacement text for a range when stripping markup.
 * - accept: additions keep content, deletions removed, substitutions keep new
 * - reject: additions removed, deletions keep content, substitutions keep old
 * Comments are always removed; highlights are always unwrapped.
 */
function getStripText(range: CriticRange, mode: "accept" | "reject"): string {
  switch (range.type) {
    case CriticType.ADDITION:
      return mode === "accept" ? range.content : "";
    case CriticType.DELETION:
      return mode === "accept" ? "" : range.content;
    case CriticType.SUBSTITUTION:
      return mode === "accept" ? (range.newContent ?? "") : (range.oldContent ?? "");
    case CriticType.COMMENT:
      return "";
    case CriticType.HIGHLIGHT:
      return range.content;
  }
}

/**
 * Strip all CriticMarkup from the document.
 * Creates a single undoable transaction.
 */
export function stripAllMarkup(view: EditorView, mode: "accept" | "reject"): void {
  const ranges = view.state.field(criticRangesField);
  if (ranges.length === 0) return;

  // Process in reverse order to preserve positions
  const changes = [...ranges]
    .reverse()
    .map((range) => ({
      from: range.from,
      to: range.to,
      insert: getStripText(range, mode),
    }));

  view.dispatch({
    changes,
    annotations: Transaction.userEvent.of(`critic.strip-${mode}`),
  });
}
