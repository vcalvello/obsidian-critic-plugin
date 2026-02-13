import { setIcon } from "obsidian";
import { CommentThread, CriticRange } from "../types";

export interface CardCallbacks {
  onResolve: (thread: CommentThread) => void;
  onReopen: (thread: CommentThread) => void;
  onAccept: (thread: CommentThread) => void;
  onReject: (thread: CommentThread) => void;
  onReply: (thread: CommentThread, text: string) => void;
  onFocus: (thread: CommentThread) => void;
  onSaveEdit: (thread: CommentThread, text: string) => void;
  onCancelEmpty: (thread: CommentThread) => void;
}

/**
 * Format a unix timestamp (seconds) as a relative time string.
 */
function relativeTime(timestamp: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - timestamp;

  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString();
}

/**
 * Get the first character of an author name for the avatar.
 */
function authorInitial(author?: string): string {
  return (author ?? "?")[0].toUpperCase();
}

/**
 * Auto-resize a textarea to fit its content (starts as single line).
 */
function autoResize(textarea: HTMLTextAreaElement): void {
  textarea.style.height = "auto";
  textarea.style.height = textarea.scrollHeight + "px";
}

/**
 * Set up a textarea with single-line start, auto-grow, and Cmd+Enter submit.
 */
function setupTextarea(
  textarea: HTMLTextAreaElement,
  onSubmit: () => void,
): void {
  textarea.rows = 1;
  // Auto-resize on input
  textarea.addEventListener("input", () => autoResize(textarea));
  // Cmd+Shift+Enter or Ctrl+Shift+Enter to submit
  textarea.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      onSubmit();
    }
  }, true);
  // Custom event dispatched by Obsidian command (Mod+Enter hotkey)
  textarea.addEventListener("critic-submit", () => {
    onSubmit();
  });
  // Initial resize (for draft text)
  requestAnimationFrame(() => autoResize(textarea));
}

/**
 * Create an icon button element.
 */
function iconButton(iconName: string, title: string, onClick: (e: MouseEvent) => void): HTMLElement {
  const btn = document.createElement("button");
  btn.setAttribute("aria-label", title);
  btn.title = title;
  setIcon(btn, iconName);
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    onClick(e);
  });
  return btn;
}

/**
 * Render a comment card for a thread.
 * If isPending is true, shows an input for the new comment text instead of body.
 * draftText pre-fills the textarea for draft comments.
 */
export function renderCard(
  thread: CommentThread,
  callbacks: CardCallbacks,
  focusedId: string | null,
  isPending: boolean,
  draftText?: string,
  replyDraftText?: string
): HTMLElement {
  const card = document.createElement("div");
  card.className = "critic-card";
  card.dataset.threadId = thread.id;
  if (thread.status === "resolved") card.classList.add("is-resolved");
  if (focusedId === thread.id) card.classList.add("is-focused");

  // Click card to focus the comment in the editor
  card.addEventListener("click", () => callbacks.onFocus(thread));

  // Anchor text (if comment type with highlight)
  if (thread.anchor) {
    const anchorEl = document.createElement("div");
    anchorEl.className = "critic-card-anchor";
    const text = thread.anchor.content;
    anchorEl.textContent = text.length > 80 ? text.slice(0, 80) + "..." : text;
    card.appendChild(anchorEl);
  }

  // Suggestion preview (if suggestion type)
  if (thread.type === "suggestion") {
    const sugEl = document.createElement("div");
    sugEl.className = "critic-card-suggestion";
    if (thread.root.oldContent !== undefined) {
      const oldSpan = document.createElement("span");
      oldSpan.className = "critic-card-suggestion-old";
      oldSpan.textContent = thread.root.oldContent || "(empty)";
      sugEl.appendChild(oldSpan);
      sugEl.appendChild(document.createTextNode(" \u2192 "));
      const newSpan = document.createElement("span");
      newSpan.className = "critic-card-suggestion-new";
      newSpan.textContent = thread.root.newContent || "(empty)";
      sugEl.appendChild(newSpan);
    } else {
      const content = thread.root.content;
      sugEl.textContent = content.length > 100 ? content.slice(0, 100) + "..." : content;
    }
    card.appendChild(sugEl);
  }

  // Header with author, time, action buttons
  const header = document.createElement("div");
  header.className = "critic-card-header";

  const avatar = document.createElement("span");
  avatar.className = "critic-card-avatar";
  avatar.textContent = authorInitial(thread.root.metadata?.author);
  header.appendChild(avatar);

  const authorSpan = document.createElement("span");
  authorSpan.className = "critic-card-author";
  authorSpan.textContent = thread.root.metadata?.author ?? "Unknown";
  header.appendChild(authorSpan);

  const timeSpan = document.createElement("span");
  timeSpan.className = "critic-card-time";
  timeSpan.textContent = thread.root.metadata?.time
    ? relativeTime(thread.root.metadata.time)
    : "";
  header.appendChild(timeSpan);

  // Action buttons
  const actions = document.createElement("span");
  actions.className = "critic-card-actions";

  if (thread.type === "suggestion") {
    actions.appendChild(iconButton("check", "Accept suggestion", () => callbacks.onAccept(thread)));
    actions.appendChild(iconButton("x", "Reject suggestion", () => callbacks.onReject(thread)));
  }

  if (thread.status === "open") {
    actions.appendChild(iconButton("check-circle", "Resolve", () => callbacks.onResolve(thread)));
  } else {
    actions.appendChild(iconButton("rotate-ccw", "Re-open", () => callbacks.onReopen(thread)));
  }

  header.appendChild(actions);
  card.appendChild(header);

  // Body or input (for pending comments)
  if (isPending) {
    const inputContainer = document.createElement("div");
    inputContainer.className = "critic-card-input";

    const textarea = document.createElement("textarea");
    textarea.placeholder = "Write a comment...";
    if (draftText) textarea.value = draftText;
    textarea.addEventListener("click", (e) => e.stopPropagation());
    inputContainer.appendChild(textarea);

    const submitComment = () => {
      const text = textarea.value.trim();
      if (text) {
        // Clear before callback: the callback triggers re-render via range change,
        // and saveDraftTexts would capture the text as a reply draft otherwise.
        textarea.value = "";
        callbacks.onSaveEdit(thread, text);
      }
    };

    setupTextarea(textarea, submitComment);

    const inputActions = document.createElement("div");
    inputActions.className = "critic-card-input-actions";

    const cancelBtn = document.createElement("button");
    cancelBtn.textContent = "Cancel";
    cancelBtn.className = "mod-secondary";
    cancelBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      callbacks.onCancelEmpty(thread);
    });
    inputActions.appendChild(cancelBtn);

    const saveBtn = document.createElement("button");
    saveBtn.textContent = "Comment";
    saveBtn.className = "mod-cta";
    saveBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      submitComment();
    });
    inputActions.appendChild(saveBtn);

    inputContainer.appendChild(inputActions);
    card.appendChild(inputContainer);

    // Auto-focus only for new comments (no draft text yet)
    if (!draftText) {
      setTimeout(() => textarea.focus(), 0);
    }

    // On blur: cancel if empty, keep as draft if has content
    textarea.addEventListener("blur", () => {
      setTimeout(() => {
        if (!textarea.isConnected) return;
        if (!textarea.value.trim()) {
          callbacks.onCancelEmpty(thread);
        }
      }, 200);
    });

    // Escape to cancel
    textarea.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        callbacks.onCancelEmpty(thread);
      }
    });
  } else if (thread.type === "comment") {
    const body = document.createElement("div");
    body.className = "critic-card-body";
    body.textContent = thread.root.content || "(empty comment)";
    card.appendChild(body);
  }

  // Replies
  if (thread.replies.length > 0) {
    const repliesContainer = document.createElement("div");
    repliesContainer.className = "critic-card-replies";

    for (const reply of thread.replies) {
      const replyEl = document.createElement("div");
      replyEl.className = "critic-card-reply";

      const replyHeader = document.createElement("div");
      replyHeader.className = "critic-card-reply-header";

      const replyAvatar = document.createElement("span");
      replyAvatar.className = "critic-card-avatar";
      replyAvatar.textContent = authorInitial(reply.metadata?.author);
      replyAvatar.style.width = "20px";
      replyAvatar.style.height = "20px";
      replyAvatar.style.fontSize = "10px";
      replyHeader.appendChild(replyAvatar);

      const replyAuthor = document.createElement("span");
      replyAuthor.className = "critic-card-reply-author";
      replyAuthor.textContent = reply.metadata?.author ?? "Unknown";
      replyHeader.appendChild(replyAuthor);

      const replyTime = document.createElement("span");
      replyTime.className = "critic-card-reply-time";
      replyTime.textContent = reply.metadata?.time ? relativeTime(reply.metadata.time) : "";
      replyHeader.appendChild(replyTime);

      replyEl.appendChild(replyHeader);

      const replyBody = document.createElement("div");
      replyBody.className = "critic-card-reply-body";
      replyBody.textContent = reply.content;
      replyEl.appendChild(replyBody);

      repliesContainer.appendChild(replyEl);
    }

    card.appendChild(repliesContainer);
  }

  // Reply input (shown for non-pending, non-resolved cards)
  if (!isPending && thread.status !== "resolved") {
    const replyContainer = document.createElement("div");
    replyContainer.className = "critic-card-input";

    const replyTextarea = document.createElement("textarea");
    replyTextarea.placeholder = "Reply...";
    if (replyDraftText) replyTextarea.value = replyDraftText;
    replyTextarea.addEventListener("click", (e) => e.stopPropagation());
    replyContainer.appendChild(replyTextarea);

    const submitReply = () => {
      const text = replyTextarea.value.trim();
      if (text) {
        // Clear before callback: the callback triggers re-render via range change,
        // and saveDraftTexts would capture the old text otherwise.
        replyTextarea.value = "";
        replyActions.style.display = "none";
        autoResize(replyTextarea);
        callbacks.onReply(thread, text);
      }
    };

    setupTextarea(replyTextarea, submitReply);

    const replyActions = document.createElement("div");
    replyActions.className = "critic-card-input-actions";
    replyActions.style.display = replyDraftText ? "" : "none";

    const replyCancelBtn = document.createElement("button");
    replyCancelBtn.textContent = "Cancel";
    replyCancelBtn.className = "mod-secondary";
    replyCancelBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      replyTextarea.value = "";
      replyActions.style.display = "none";
      autoResize(replyTextarea);
    });
    replyActions.appendChild(replyCancelBtn);

    const replySubmitBtn = document.createElement("button");
    replySubmitBtn.textContent = "Reply";
    replySubmitBtn.className = "mod-cta";
    replySubmitBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      submitReply();
    });
    replyActions.appendChild(replySubmitBtn);

    replyContainer.appendChild(replyActions);

    // Show/hide buttons based on content
    replyTextarea.addEventListener("input", () => {
      replyActions.style.display = replyTextarea.value.trim() ? "" : "none";
    });
    replyTextarea.addEventListener("focus", () => {
      if (replyTextarea.value.trim()) {
        replyActions.style.display = "";
      }
    });

    card.appendChild(replyContainer);
  }

  return card;
}
