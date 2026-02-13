import { App, PluginSettingTab, Setting } from "obsidian";
import { EditorMode } from "../types";
import type CriticPlugin from "../main";

export class CriticSettingTab extends PluginSettingTab {
  plugin: CriticPlugin;

  constructor(app: App, plugin: CriticPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName("Author name")
      .setDesc("Your name for comments and suggestions")
      .addText((text) =>
        text
          .setPlaceholder("e.g. Victor")
          .setValue(this.plugin.settings.authorName)
          .onChange(async (value) => {
            this.plugin.settings.authorName = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Default mode")
      .setDesc("Mode to activate when opening the plugin (takes effect after reloading the plugin)")
      .addDropdown((dropdown) =>
        dropdown
          .addOption(EditorMode.EDITING, "Editing")
          .addOption(EditorMode.SUGGESTING, "Suggesting")
          .addOption(EditorMode.VIEWING, "Viewing")
          .setValue(this.plugin.settings.defaultMode)
          .onChange(async (value) => {
            this.plugin.settings.defaultMode = value as EditorMode;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Show gutter markers")
      .setDesc("Display comment and suggestion indicators in the gutter")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.showGutter)
          .onChange(async (value) => {
            this.plugin.settings.showGutter = value;
            await this.plugin.saveSettings();
            this.plugin.reconfigureGutter();
          })
      );
  }
}
