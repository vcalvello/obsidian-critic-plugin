import { StateField } from "@codemirror/state";
import { CriticRange } from "../types";
import { parseCriticMarkup } from "../parser/critic-parser";

/**
 * StateField that holds all parsed CriticRange[] for the current document.
 * Re-parses the full document on every change (adequate for Phase 1).
 */
export const criticRangesField = StateField.define<CriticRange[]>({
  create(state) {
    return parseCriticMarkup(state.doc.toString());
  },
  update(ranges, tr) {
    if (tr.docChanged) {
      return parseCriticMarkup(tr.newDoc.toString());
    }
    return ranges;
  },
});
