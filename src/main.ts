import { Menu, Notice, Plugin, setIcon } from "obsidian";
import { EditorView } from "@codemirror/view";
import { EditorState, Prec } from "@codemirror/state";
import { CriticPluginSettings, DEFAULT_SETTINGS, EditorMode } from "./types";
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

export default class CriticPlugin extends Plugin {
  settings: CriticPluginSettings = DEFAULT_SETTINGS;
  currentMode: EditorMode = EditorMode.EDITING;
  statusBarEl: HTMLElement | null = null;

  async onload() {
    await this.loadSettings();

    // Register CM6 extensions
    this.registerEditorExtension([
      criticRangesField,
      criticDecorationsField,
      editorModeField,
      suggestingModeCompartment.of([]),
      readOnlyCompartment.of(EditorState.readOnly.of(false)),
    ]);

    // Setup status bar
    this.statusBarEl = this.addStatusBarItem();
    this.statusBarEl.addClass("critic-mode-status");
    this.updateStatusBar();
    this.statusBarEl.addEventListener("click", (e) => {
      this.showModeMenu(e);
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

    // Settings tab
    this.addSettingTab(new CriticSettingTab(this.app, this));

    // Update status bar on leaf change
    this.registerEvent(
      this.app.workspace.on("active-leaf-change", () => {
        this.updateStatusBar();
      })
    );
  }

  onunload() {
    // Cleanup is handled by Obsidian's plugin lifecycle
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
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
}
