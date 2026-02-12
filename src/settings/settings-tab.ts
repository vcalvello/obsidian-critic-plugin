import { App, PluginSettingTab, Setting } from "obsidian";
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
  }
}
