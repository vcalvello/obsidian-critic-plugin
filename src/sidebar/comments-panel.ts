import { ItemView, WorkspaceLeaf, setIcon } from "obsidian";
import { CriticRange, CommentThread } from "../types";
import { buildThreads } from "../comments/threads";
import { renderCard, CardCallbacks } from "./comment-card";
import { filterThreads, ThreadFilter } from "./filters";

export const COMMENTS_VIEW_TYPE = "critic-comments";

export interface PanelCallbacks extends CardCallbacks {
  onAcceptAll?: () => void;
  onRejectAll?: () => void;
  onResolveAll?: () => void;
}

export class CommentsPanel extends ItemView {
  private threads: CommentThread[] = [];
  private filter: ThreadFilter = "all";
  private searchQuery = "";
  private focusedId: string | null = null;
  /** Set of comment IDs that are in pending/draft state (showing textarea). */
  private pendingCommentIds = new Set<string>();
  /** Saved textarea content for drafts, keyed by comment ID. */
  private draftTexts = new Map<string, string>();
  /** Saved reply textarea content for reply drafts, keyed by thread ID. */
  private replyDraftTexts = new Map<string, string>();
  private callbacks: PanelCallbacks | null = null;
  private listEl: HTMLElement | null = null;
  private filterSelectEl: HTMLSelectElement | null = null;
  private searchInputEl: HTMLInputElement | null = null;

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
  }

  getViewType(): string {
    return COMMENTS_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "Comments";
  }

  getIcon(): string {
    return "message-square";
  }

  setCallbacks(callbacks: PanelCallbacks): void {
    this.callbacks = callbacks;
  }

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.addClass("critic-panel");

    // Header
    const header = container.createDiv({ cls: "critic-panel-header" });
    header.createEl("h4", { text: "Comments" });

    // Batch action buttons
    const actions = header.createDiv({ cls: "critic-panel-header-actions" });

    const acceptAllBtn = actions.createEl("button", { attr: { "aria-label": "Accept all suggestions" } });
    setIcon(acceptAllBtn, "check-check");
    acceptAllBtn.addEventListener("click", () => this.callbacks?.onAcceptAll?.());

    const rejectAllBtn = actions.createEl("button", { attr: { "aria-label": "Reject all suggestions" } });
    setIcon(rejectAllBtn, "x");
    rejectAllBtn.addEventListener("click", () => this.callbacks?.onRejectAll?.());

    const resolveAllBtn = actions.createEl("button", { attr: { "aria-label": "Resolve all comments" } });
    setIcon(resolveAllBtn, "check-circle-2");
    resolveAllBtn.addEventListener("click", () => this.callbacks?.onResolveAll?.());

    // Filters
    const filters = container.createDiv({ cls: "critic-panel-filters" });

    this.filterSelectEl = filters.createEl("select");
    for (const [value, label] of [
      ["all", "All"],
      ["open", "Open"],
      ["resolved", "Resolved"],
    ] as const) {
      const opt = this.filterSelectEl.createEl("option", { text: label, value });
      if (value === this.filter) opt.selected = true;
    }
    this.filterSelectEl.addEventListener("change", () => {
      this.filter = this.filterSelectEl!.value as ThreadFilter;
      this.renderCards();
    });

    this.searchInputEl = filters.createEl("input", {
      type: "text",
      placeholder: "Search...",
    });
    this.searchInputEl.addEventListener("input", () => {
      this.searchQuery = this.searchInputEl!.value;
      this.renderCards();
    });

    // Card list
    this.listEl = container.createDiv({ cls: "critic-panel-list" });
    this.renderCards();
  }

  async onClose(): Promise<void> {
    // Cleanup handled by Obsidian
  }

  /**
   * Called by the plugin when ranges change. Rebuilds threads and re-renders.
   */
  update(ranges: CriticRange[]): void {
    this.threads = buildThreads(ranges);
    this.renderCards();
  }

  /**
   * Set the focused comment ID and re-render.
   */
  setFocusedId(id: string | null): void {
    this.focusedId = id;
    this.renderCards();
  }

  /**
   * Add a comment ID to the pending/draft set and re-render.
   */
  setPendingComment(commentId: string | null): void {
    if (commentId) {
      this.pendingCommentIds.add(commentId);
    }
    this.renderCards();
  }

  /**
   * Remove a comment from the pending/draft set (after save or cancel).
   */
  removePendingComment(commentId: string): void {
    this.pendingCommentIds.delete(commentId);
    this.draftTexts.delete(commentId);
    this.renderCards();
  }

  /**
   * Focus a card: scroll to it and expand it.
   */
  focusCard(commentId: string): void {
    this.focusedId = commentId;
    this.renderCards();

    // Scroll card into view and focus textarea if draft
    const cardEl = this.listEl?.querySelector(`[data-thread-id="${commentId}"]`);
    if (cardEl) {
      cardEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
      // If this card has a draft textarea with text, focus it
      const textarea = cardEl.querySelector<HTMLTextAreaElement>(".critic-card-input textarea");
      if (textarea && textarea.value.trim()) {
        setTimeout(() => textarea.focus(), 0);
      }
    }
  }

  /**
   * Save textarea content from currently rendered draft cards before re-rendering.
   */
  private saveDraftTexts(): void {
    if (!this.listEl) return;
    const cards = this.listEl.querySelectorAll<HTMLElement>(".critic-card");
    for (const card of cards) {
      const threadId = card.dataset.threadId;
      if (!threadId) continue;
      const isPending = this.pendingCommentIds.has(threadId);
      const textareas = card.querySelectorAll<HTMLTextAreaElement>(".critic-card-input textarea");
      for (const textarea of textareas) {
        // Pending cards have a comment textarea; non-pending have a reply textarea
        const map = isPending ? this.draftTexts : this.replyDraftTexts;
        if (textarea.value) {
          map.set(threadId, textarea.value);
        } else {
          map.delete(threadId);
        }
      }
    }
  }

  private renderCards(): void {
    if (!this.listEl || !this.callbacks) return;

    // Preserve draft text and scroll position before clearing DOM
    this.saveDraftTexts();
    const scrollTop = this.listEl.scrollTop;
    this.listEl.empty();

    const filtered = filterThreads(this.threads, this.filter, this.searchQuery);

    if (filtered.length === 0) {
      const empty = this.listEl.createDiv({ cls: "critic-panel-empty" });
      empty.textContent = this.threads.length === 0 ? "No comments yet" : "No matching comments";
      return;
    }

    for (const thread of filtered) {
      const isPending = this.pendingCommentIds.has(thread.id);
      const draftText = this.draftTexts.get(thread.id);
      const replyDraftText = this.replyDraftTexts.get(thread.id);
      const card = renderCard(thread, this.callbacks, this.focusedId, isPending, draftText, replyDraftText);
      this.listEl.appendChild(card);
    }

    // Restore scroll position
    this.listEl.scrollTop = scrollTop;
  }
}
