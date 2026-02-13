import { Menu, Notice, Plugin, setIcon } from "obsidian";
import { EditorView, ViewPlugin, ViewUpdate } from "@codemirror/view";
import { Compartment, EditorState, Prec } from "@codemirror/state";
import { CriticPluginSettings, CriticRange, CriticType, DEFAULT_SETTINGS, EditorMode } from "./types";
import { criticRangesField } from "./editor/state";
import { criticDecorationsField } from "./editor/decorations";
import {
  editorModeField,
  setModeEffect,
  suggestingModeCompartment,
  readOnlyCompartment,
} from "./modes/mode-state";
import { suggestingModeFilter } from "./modes/suggesting-mode";
import {
  findSuggestionAtCursor,
  acceptSuggestion,
  rejectSuggestion,
  acceptAllSuggestions,
  rejectAllSuggestions,
} from "./commands/accept-reject";
import { CriticSettingTab } from "./settings/settings-tab";
import { focusedCommentField, setFocusedCommentEffect, commentCreatedEffect } from "./editor/focused-comment";
import { authorNameFacet } from "./editor/floating-toolbar";
import { CommentsPanel, COMMENTS_VIEW_TYPE } from "./sidebar/comments-panel";
import { addComment, saveCommentText, cancelEmptyComment, addReply } from "./comments/create-comment";
import { resolveComment, reopenComment, resolveAllComments } from "./comments/resolve";
import { criticGutter, gutterCompartment } from "./editor/gutter-markers";
import { criticReadingViewProcessor } from "./editor/reading-view";
import { stripAllMarkup } from "./commands/strip";
import { cleanClipboardHandler } from "./editor/clean-clipboard";

const MODE_ICONS: Record<EditorMode, string> = {
  [EditorMode.EDITING]: "pencil",
  [EditorMode.SUGGESTING]: "pencil-line",
  [EditorMode.VIEWING]: "eye",
};

const MODE_LABELS: Record<EditorMode, string> = {
  [EditorMode.EDITING]: "Editing",
  [EditorMode.SUGGESTING]: "Suggesting",
  [EditorMode.VIEWING]: "Viewing",
};

/** Compartment for the authorNameFacet so we can reconfigure on settings change. */
const authorNameCompartment = new Compartment();

/**
 * Find the comment/suggestion ID at the cursor position, if any.
 * Checks: highlight anchors (for comments) and suggestion ranges (addition/deletion/substitution).
 */
function findCommentIdAtPosition(ranges: CriticRange[], pos: number): string | null {
  for (let i = 0; i < ranges.length; i++) {
    const r = ranges[i];
    // Highlight anchor for a comment
    if (r.type === CriticType.HIGHLIGHT && pos >= r.from && pos <= r.to) {
      const next = ranges[i + 1];
      if (
        next &&
        next.type === CriticType.COMMENT &&
        next.from === r.to &&
        next.metadata?.id &&
        !next.metadata.replyTo
      ) {
        return next.metadata.id;
      }
    }
    // Suggestion ranges (addition/deletion/substitution with metadata)
    if (
      (r.type === CriticType.ADDITION ||
        r.type === CriticType.DELETION ||
        r.type === CriticType.SUBSTITUTION) &&
      r.metadata?.id &&
      pos >= r.from &&
      pos <= r.to
    ) {
      return r.metadata.id;
    }
  }
  return null;
}

export default class CriticPlugin extends Plugin {
  settings: CriticPluginSettings = DEFAULT_SETTINGS;
  currentMode: EditorMode = EditorMode.EDITING;
  statusBarEl: HTMLElement | null = null;
  /** Track the last active editor view so sidebar callbacks work even when sidebar is focused. */
  private lastEditorView: EditorView | null = null;

  async onload() {
    await this.loadSettings();

    // Register the comments sidebar view
    this.registerView(COMMENTS_VIEW_TYPE, (leaf) => {
      const panel = new CommentsPanel(leaf);
      panel.setCallbacks(this.buildSidebarCallbacks());
      // Push current ranges on creation
      if (this.lastEditorView) {
        const ranges = this.lastEditorView.state.field(criticRangesField);
        // Defer so the view is fully mounted
        setTimeout(() => panel.update(ranges), 0);
      }
      return panel;
    });

    // Register CM6 extensions
    this.registerEditorExtension([
      criticRangesField,
      focusedCommentField,
      criticDecorationsField,
      editorModeField,
      gutterCompartment.of(this.settings.showGutter ? criticGutter() : []),
      authorNameCompartment.of(authorNameFacet.of(this.settings.authorName)),
      suggestingModeCompartment.of([]),
      readOnlyCompartment.of(EditorState.readOnly.of(false)),
      cleanClipboardHandler(),
      this.buildBridgePlugin(),
    ]);

    // Setup status bar
    this.statusBarEl = this.addStatusBarItem();
    this.statusBarEl.addClass("critic-mode-status");
    this.updateStatusBar();
    this.statusBarEl.addEventListener("click", (e) => {
      this.showModeMenu(e);
    });

    // Ribbon icon to toggle sidebar
    this.addRibbonIcon("message-square", "Toggle comments", () => {
      this.toggleSidebar();
    });

    // Register mode commands
    this.addCommand({
      id: "set-editing-mode",
      name: "Set mode: Editing",
      hotkeys: [{ modifiers: ["Mod", "Shift"], key: "e" }],
      callback: () => this.setMode(EditorMode.EDITING),
    });

    this.addCommand({
      id: "set-suggesting-mode",
      name: "Set mode: Suggesting",
      hotkeys: [{ modifiers: ["Mod", "Shift"], key: "s" }],
      callback: () => this.setMode(EditorMode.SUGGESTING),
    });

    this.addCommand({
      id: "set-viewing-mode",
      name: "Set mode: Viewing",
      hotkeys: [{ modifiers: ["Mod", "Shift"], key: "d" }],
      callback: () => this.setMode(EditorMode.VIEWING),
    });

    // Register accept/reject commands
    this.addCommand({
      id: "accept-suggestion",
      name: "Accept suggestion at cursor",
      editorCheckCallback: (checking, editor, view) => {
        // @ts-ignore - Obsidian provides cm as EditorView
        const cmView = (view as any)?.editor?.cm as EditorView | undefined;
        if (!cmView) return false;
        const range = findSuggestionAtCursor(cmView.state);
        if (checking) return range !== undefined;
        if (range) acceptSuggestion(cmView, range);
        return true;
      },
    });

    this.addCommand({
      id: "reject-suggestion",
      name: "Reject suggestion at cursor",
      editorCheckCallback: (checking, editor, view) => {
        const cmView = (view as any)?.editor?.cm as EditorView | undefined;
        if (!cmView) return false;
        const range = findSuggestionAtCursor(cmView.state);
        if (checking) return range !== undefined;
        if (range) rejectSuggestion(cmView, range);
        return true;
      },
    });

    this.addCommand({
      id: "accept-all-suggestions",
      name: "Accept all suggestions",
      editorCallback: (editor, view) => {
        const cmView = (view as any)?.editor?.cm as EditorView | undefined;
        if (cmView) acceptAllSuggestions(cmView);
      },
    });

    this.addCommand({
      id: "reject-all-suggestions",
      name: "Reject all suggestions",
      editorCallback: (editor, view) => {
        const cmView = (view as any)?.editor?.cm as EditorView | undefined;
        if (cmView) rejectAllSuggestions(cmView);
      },
    });

    // Resolve all comments command
    this.addCommand({
      id: "resolve-all-comments",
      name: "Resolve all comments",
      editorCallback: (editor, view) => {
        const cmView = (view as any)?.editor?.cm as EditorView | undefined;
        if (cmView) resolveAllComments(cmView);
      },
    });

    // Strip markup commands
    this.addCommand({
      id: "strip-accept",
      name: "Strip markup (accept all changes)",
      editorCallback: (editor, view) => {
        const cmView = (view as any)?.editor?.cm as EditorView | undefined;
        if (cmView) stripAllMarkup(cmView, "accept");
      },
    });

    this.addCommand({
      id: "strip-reject",
      name: "Strip markup (reject all changes)",
      editorCallback: (editor, view) => {
        const cmView = (view as any)?.editor?.cm as EditorView | undefined;
        if (cmView) stripAllMarkup(cmView, "reject");
      },
    });

    // Register Reading View post-processor
    this.registerMarkdownPostProcessor(criticReadingViewProcessor);

    // Submit comment/reply from sidebar textarea via Cmd+Enter
    this.addCommand({
      id: "submit-comment",
      name: "Submit comment",
      hotkeys: [{ modifiers: ["Mod", "Shift"], key: "Enter" }],
      checkCallback: (checking) => {
        const activeEl = document.activeElement;
        if (
          activeEl instanceof HTMLTextAreaElement &&
          activeEl.closest(".critic-card-input")
        ) {
          if (!checking) {
            activeEl.dispatchEvent(new Event("critic-submit"));
          }
          return true;
        }
        return false;
      },
    });

    // Add comment command
    this.addCommand({
      id: "add-comment",
      name: "Add comment",
      hotkeys: [{ modifiers: ["Mod", "Shift"], key: "m" }],
      editorCallback: (editor, view) => {
        if (!this.settings.authorName) {
          new Notice("Please set your author name in CriticMarkup settings first.");
          return;
        }
        if (this.currentMode === EditorMode.VIEWING) {
          new Notice("Cannot add comments in Viewing mode.");
          return;
        }
        const cmView = (view as any)?.editor?.cm as EditorView | undefined;
        if (!cmView) return;
        const commentId = addComment(cmView, this.settings.authorName);
        this.openSidebarAndFocus(commentId);
      },
    });

    // Right-click context menu: add comment
    this.registerEvent(
      this.app.workspace.on("editor-menu", (menu, editor, view) => {
        if (this.currentMode === EditorMode.VIEWING) return;
        const cmView = (view as any)?.editor?.cm as EditorView | undefined;
        if (!cmView) return;
        const sel = cmView.state.selection.main;
        if (sel.empty) return;

        menu.addItem((item) => {
          item
            .setTitle("Add comment")
            .setIcon("message-square")
            .onClick(() => {
              if (!this.settings.authorName) {
                new Notice("Please set your author name in CriticMarkup settings first.");
                return;
              }
              const commentId = addComment(cmView, this.settings.authorName);
              this.openSidebarAndFocus(commentId);
            });
        });
      })
    );

    // Settings tab
    this.addSettingTab(new CriticSettingTab(this.app, this));

    // Apply default mode on layout ready (delay ensures CM6 extensions are mounted)
    this.app.workspace.onLayoutReady(() => {
      setTimeout(() => {
        const mode = this.settings.defaultMode;
        // Fallback to EDITING if Suggesting requires author name
        if (mode === EditorMode.SUGGESTING && !this.settings.authorName) {
          this.setMode(EditorMode.EDITING);
        } else if (mode !== EditorMode.EDITING) {
          this.setMode(mode);
        }
      }, 200);
    });

    // Update status bar on leaf change and track last active editor
    this.registerEvent(
      this.app.workspace.on("active-leaf-change", (leaf) => {
        this.syncActiveEditor(leaf);
      })
    );

    // layout-change fires when tabs are closed/rearranged (active-leaf-change may not)
    this.registerEvent(
      this.app.workspace.on("layout-change", () => {
        const leaf = this.app.workspace.activeLeaf;
        this.syncActiveEditor(leaf ?? null);
      })
    );
  }

  onunload() {
    // Cleanup is handled by Obsidian's plugin lifecycle
  }

  /**
   * Reconfigure the gutter compartment in all editors based on settings.
   */
  reconfigureGutter(): void {
    this.app.workspace.iterateAllLeaves((leaf) => {
      const cmView = (leaf.view as any)?.editor?.cm as EditorView | undefined;
      if (!cmView) return;
      cmView.dispatch({
        effects: gutterCompartment.reconfigure(
          this.settings.showGutter ? criticGutter() : []
        ),
      });
    });
  }

  /**
   * Sync the sidebar and internal state when the active editor changes.
   * Called from both active-leaf-change and layout-change events.
   */
  private syncActiveEditor(leaf: any): void {
    this.updateStatusBar();

    // Ignore when the comments sidebar itself becomes the active leaf
    if (leaf?.view instanceof CommentsPanel) return;

    const cmView = leaf ? (leaf.view as any)?.editor?.cm as EditorView | undefined : undefined;
    if (cmView) {
      this.lastEditorView = cmView;
      // Push current ranges to sidebar so it populates on doc open
      const panel = this.getSidebarView();
      if (panel) {
        const ranges = cmView.state.field(criticRangesField);
        panel.update(ranges);
      }
    } else {
      // No active editor (doc closed or non-editor leaf): clear sidebar
      this.lastEditorView = null;
      const panel = this.getSidebarView();
      if (panel) panel.update([]);
    }
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
    // Update the author name facet in all editors
    this.app.workspace.iterateAllLeaves((leaf) => {
      const cmView = (leaf.view as any)?.editor?.cm as EditorView | undefined;
      if (!cmView) return;
      cmView.dispatch({
        effects: authorNameCompartment.reconfigure(
          authorNameFacet.of(this.settings.authorName)
        ),
      });
    });
  }

  /**
   * Set the editor mode across all open editors.
   */
  setMode(mode: EditorMode) {
    if (mode === EditorMode.SUGGESTING && !this.settings.authorName) {
      new Notice("Please set your author name in CriticMarkup settings before using Suggesting mode.");
      return;
    }

    this.currentMode = mode;
    this.updateStatusBar();

    // Reconfigure all editor views
    this.app.workspace.iterateAllLeaves((leaf) => {
      // @ts-ignore - accessing internal CM6 view
      const cmView = (leaf.view as any)?.editor?.cm as EditorView | undefined;
      if (!cmView) return;

      const effects = [
        setModeEffect.of(mode),
        suggestingModeCompartment.reconfigure(
          mode === EditorMode.SUGGESTING
            ? Prec.high(suggestingModeFilter(this.settings.authorName))
            : []
        ),
        readOnlyCompartment.reconfigure(
          EditorState.readOnly.of(mode === EditorMode.VIEWING)
        ),
      ];

      cmView.dispatch({ effects });
    });
  }

  /**
   * Update the status bar to reflect the current mode.
   */
  updateStatusBar() {
    if (!this.statusBarEl) return;
    this.statusBarEl.empty();

    const iconEl = this.statusBarEl.createSpan({ cls: "menu-icon" });
    setIcon(iconEl, MODE_ICONS[this.currentMode]);

    this.statusBarEl.createSpan({ text: MODE_LABELS[this.currentMode] });
  }

  /**
   * Show the mode selection menu above the status bar.
   */
  showModeMenu(e: MouseEvent) {
    const menu = new Menu();

    for (const mode of [EditorMode.EDITING, EditorMode.SUGGESTING, EditorMode.VIEWING]) {
      menu.addItem((item) => {
        item
          .setTitle(MODE_LABELS[mode])
          .setIcon(MODE_ICONS[mode])
          .setChecked(this.currentMode === mode)
          .onClick(() => this.setMode(mode));
      });
    }

    menu.showAtMouseEvent(e);
  }

  // ========================================
  // Comments sidebar
  // ========================================

  /**
   * Get the comments sidebar view (if open).
   */
  getSidebarView(): CommentsPanel | null {
    const leaves = this.app.workspace.getLeavesOfType(COMMENTS_VIEW_TYPE);
    if (leaves.length > 0) {
      return leaves[0].view as CommentsPanel;
    }
    return null;
  }

  /**
   * Toggle the comments sidebar.
   */
  async toggleSidebar(): Promise<void> {
    const existing = this.getSidebarView();
    if (existing) {
      existing.leaf.detach();
    } else {
      await this.app.workspace.getRightLeaf(false)?.setViewState({
        type: COMMENTS_VIEW_TYPE,
        active: true,
      });
    }
  }

  /**
   * Open sidebar and focus a specific comment card (pending input for new comment).
   */
  async openSidebarAndFocus(commentId: string): Promise<void> {
    const panel = await this.ensureSidebarOpen();
    if (panel) {
      panel.setPendingComment(commentId);
      panel.focusCard(commentId);
    }
  }

  /**
   * Open sidebar if not open and focus a card (no pending input, for indicator clicks).
   */
  async openSidebarAndFocusExisting(commentId: string): Promise<void> {
    const panel = await this.ensureSidebarOpen();
    if (panel) {
      panel.focusCard(commentId);
    }
  }

  /**
   * Ensure sidebar is open and synced. Returns the panel.
   */
  private async ensureSidebarOpen(): Promise<CommentsPanel | null> {
    let panel = this.getSidebarView();
    if (!panel) {
      await this.app.workspace.getRightLeaf(false)?.setViewState({
        type: COMMENTS_VIEW_TYPE,
        active: true,
      });
      await new Promise((resolve) => setTimeout(resolve, 100));
      panel = this.getSidebarView();
    }
    if (panel) {
      const cmView = this.lastEditorView;
      if (cmView) {
        const ranges = cmView.state.field(criticRangesField);
        panel.update(ranges);
      }
    }
    return panel;
  }

  /**
   * Called when critic ranges change in any editor (via bridge ViewPlugin).
   */
  onRangesChanged(ranges: CriticRange[]): void {
    const panel = this.getSidebarView();
    if (panel) {
      panel.update(ranges);
    }
  }

  /**
   * Get the last known editor view (works even when sidebar is focused).
   */
  getEditorView(): EditorView | null {
    return this.lastEditorView;
  }

  /**
   * Build a CM6 ViewPlugin that bridges editor state changes to the plugin.
   */
  private buildBridgePlugin() {
    const plugin = this;
    return ViewPlugin.fromClass(
      class {
        private lastRanges: CriticRange[] = [];
        private lastCursorCommentId: string | null = null;

        constructor(private view: EditorView) {
          this.lastRanges = view.state.field(criticRangesField);
          // Track this as the last known editor
          plugin.lastEditorView = view;
          plugin.onRangesChanged(this.lastRanges);
        }

        update(update: ViewUpdate) {
          // Always update the reference to the latest view
          plugin.lastEditorView = this.view;

          const newRanges = update.state.field(criticRangesField);
          if (newRanges !== this.lastRanges) {
            this.lastRanges = newRanges;
            plugin.onRangesChanged(newRanges);
          }

          // Check for commentCreatedEffect (from add-comment command)
          for (const tr of update.transactions) {
            for (const e of tr.effects) {
              if (e.is(commentCreatedEffect)) {
                plugin.openSidebarAndFocus(e.value);
              }
            }
          }

          // Cursor detection: auto-focus comment when cursor is inside a highlight anchor
          if (update.selectionSet) {
            const sel = update.state.selection.main;
            const ranges = update.state.field(criticRangesField);
            const commentId = findCommentIdAtPosition(ranges, sel.head);

            if (commentId !== this.lastCursorCommentId) {
              this.lastCursorCommentId = commentId;
              const view = this.view;
              requestAnimationFrame(() => {
                view.dispatch({
                  effects: setFocusedCommentEffect.of(commentId),
                });
              });
            }
          }

          // Sync focused comment from state to sidebar
          const focusedId = update.state.field(focusedCommentField, false) ?? null;
          const prevFocusedId = update.startState.field(focusedCommentField, false) ?? null;
          if (focusedId !== prevFocusedId) {
            if (focusedId) {
              // Open sidebar (if closed) and focus the card
              plugin.openSidebarAndFocusExisting(focusedId);
            } else {
              // Clear focus in the sidebar
              const panel = plugin.getSidebarView();
              if (panel) panel.setFocusedId(null);
            }
          }

        }
      }
    );
  }

  /**
   * Build callbacks that the sidebar uses to trigger actions on the editor.
   */
  private buildSidebarCallbacks() {
    return {
      onResolve: (thread: any) => {
        const cmView = this.getEditorView();
        if (cmView) resolveComment(cmView, thread.root);
      },
      onReopen: (thread: any) => {
        const cmView = this.getEditorView();
        if (cmView) reopenComment(cmView, thread.root);
      },
      onAccept: (thread: any) => {
        const cmView = this.getEditorView();
        if (cmView) acceptSuggestion(cmView, thread.root);
      },
      onReject: (thread: any) => {
        const cmView = this.getEditorView();
        if (cmView) rejectSuggestion(cmView, thread.root);
      },
      onReply: (thread: any, text: string) => {
        const cmView = this.getEditorView();
        if (cmView) addReply(cmView, thread.id, text, this.settings.authorName);
      },
      onFocus: (thread: any) => {
        const cmView = this.getEditorView();
        if (!cmView) return;

        // Focus the comment in editor state
        cmView.dispatch({
          effects: setFocusedCommentEffect.of(thread.id),
        });

        // Scroll editor so the anchor line aligns with the card's Y position
        const pos = thread.anchor?.from ?? thread.root.from;
        const panel = this.getSidebarView();
        const cardEl = panel?.containerEl?.querySelector(
          `[data-thread-id="${thread.id}"]`
        ) as HTMLElement | null;

        if (cardEl) {
          const cardTop = cardEl.getBoundingClientRect().top;
          const editorRect = cmView.scrollDOM.getBoundingClientRect();
          const lineBlock = cmView.lineBlockAt(pos);
          // Scroll so the line appears at the same viewport Y as the card
          cmView.scrollDOM.scrollTop = lineBlock.top - (cardTop - editorRect.top);
        } else {
          // Fallback: scroll to start
          cmView.dispatch({
            effects: EditorView.scrollIntoView(pos, { y: "start", yMargin: 50 }),
          });
        }
      },
      onSaveEdit: (thread: any, text: string) => {
        const cmView = this.getEditorView();
        if (cmView) {
          saveCommentText(cmView, thread.id, text);
          const panel = this.getSidebarView();
          if (panel) panel.removePendingComment(thread.id);
        }
      },
      onCancelEmpty: (thread: any) => {
        const cmView = this.getEditorView();
        if (cmView) {
          cancelEmptyComment(cmView, thread.id);
          const panel = this.getSidebarView();
          if (panel) panel.removePendingComment(thread.id);
        }
      },
      onAcceptAll: () => {
        const cmView = this.getEditorView();
        if (cmView) acceptAllSuggestions(cmView);
      },
      onRejectAll: () => {
        const cmView = this.getEditorView();
        if (cmView) rejectAllSuggestions(cmView);
      },
      onResolveAll: () => {
        const cmView = this.getEditorView();
        if (cmView) resolveAllComments(cmView);
      },
    };
  }
}
