import { StateEffect, StateField } from "@codemirror/state";

/**
 * Effect to set the currently focused comment ID.
 * Dispatch with null to clear focus.
 */
export const setFocusedCommentEffect = StateEffect.define<string | null>();

/**
 * Effect dispatched when a new comment is created via the floating toolbar.
 * The bridge plugin listens for this to open the sidebar and focus the new card.
 */
export const commentCreatedEffect = StateEffect.define<string>();

/**
 * StateField tracking which comment thread is focused (by root comment ID).
 * Used by decorations to apply focused highlight styling.
 */
export const focusedCommentField = StateField.define<string | null>({
  create() {
    return null;
  },
  update(current, tr) {
    for (const e of tr.effects) {
      if (e.is(setFocusedCommentEffect)) return e.value;
    }
    return current;
  },
});

/**
 * Get the currently focused comment ID from editor state.
 */
export function getFocusedComment(state: { field: (f: StateField<string | null>) => string | null }): string | null {
  return state.field(focusedCommentField);
}
