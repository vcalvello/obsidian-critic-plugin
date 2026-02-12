import { Compartment, StateEffect, StateField } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { EditorMode } from "../types";

/**
 * StateEffect to change the editor mode.
 */
export const setModeEffect = StateEffect.define<EditorMode>();

/**
 * StateField that holds the current editor mode.
 * Updated via setModeEffect.
 */
export const editorModeField = StateField.define<EditorMode>({
  create() {
    return EditorMode.EDITING;
  },
  update(mode, tr) {
    for (const e of tr.effects) {
      if (e.is(setModeEffect)) return e.value;
    }
    return mode;
  },
});

/**
 * Compartment to enable/disable the suggesting mode transaction filter.
 */
export const suggestingModeCompartment = new Compartment();

/**
 * Compartment to toggle EditorState.readOnly for Viewing mode.
 */
export const readOnlyCompartment = new Compartment();

/**
 * Get the current editor mode from a view.
 */
export function getEditorMode(view: EditorView): EditorMode {
  return view.state.field(editorModeField);
}
