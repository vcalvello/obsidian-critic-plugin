import { setIcon } from "obsidian";
import { EditorView, WidgetType } from "@codemirror/view";
import { setFocusedCommentEffect } from "./focused-comment";

/**
 * Inline widget that shows a small comment icon for a comment.
 * Clicking it dispatches setFocusedCommentEffect to focus the comment
 * and triggers the plugin to open the sidebar.
 */
export class CommentIndicatorWidget extends WidgetType {
  constructor(
    readonly commentId: string,
    readonly resolved: boolean
  ) {
    super();
  }

  toDOM(view: EditorView): HTMLElement {
    const span = document.createElement("span");
    span.className = "critic-comment-icon";
    if (this.resolved) span.classList.add("is-resolved");
    setIcon(span, "message-square");
    span.setAttribute("aria-label", "Comment");
    span.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      view.dispatch({ effects: setFocusedCommentEffect.of(this.commentId) });
    });
    return span;
  }

  eq(other: CommentIndicatorWidget): boolean {
    return this.commentId === other.commentId && this.resolved === other.resolved;
  }

  ignoreEvent(): boolean {
    return false;
  }
}
