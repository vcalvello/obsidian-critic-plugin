# Obsidian CriticMarkup Plugin

Track changes, comments, and suggestions in your Obsidian notes using [CriticMarkup](https://criticmarkup.com) syntax.

## Features

- **Three editor modes**: Editing (normal), Suggesting (changes tracked), Viewing (read-only preview)
- **Inline suggestions**: Additions, deletions, and substitutions rendered with visual diffs
- **Comment threads**: Highlight text and add threaded comments with replies
- **Resolve/reopen**: Mark comment threads as resolved
- **Accept/reject**: Accept or reject individual suggestions or all at once
- **Gutter markers**: Visual indicators for comments and suggestions in the gutter
- **Sidebar panel**: Browse, filter, and search all comments and suggestions
- **Reading view**: CriticMarkup rendered in Obsidian's reading mode
- **Strip/export**: Remove all markup accepting or rejecting changes (single undo)
- **Clean clipboard**: Copy/cut automatically strips CriticMarkup syntax
- **Batch actions**: Accept all, reject all, resolve all from the sidebar

## Installation

### From Obsidian Community Plugins

1. Open Settings > Community plugins
2. Search for "CriticMarkup"
3. Install and enable

### Manual

1. Download the latest release
2. Extract into `.obsidian/plugins/obsidian-critic-plugin/`
3. Enable in Settings > Community plugins

## CriticMarkup Syntax

| Type | Syntax | Example |
|------|--------|---------|
| Addition | `{++text++}` | `{++new text++}` |
| Deletion | `{--text--}` | `{--old text--}` |
| Substitution | `{~~old~>new~~}` | `{~~typo~>fixed~~}` |
| Comment | `{>>text<<}` | `{>>needs review<<}` |
| Highlight | `{==text==}` | `{==important==}` |

When in Suggesting mode, the plugin automatically wraps your edits in CriticMarkup with author metadata.

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Set mode: Editing | `Cmd/Ctrl+Shift+E` |
| Set mode: Suggesting | `Cmd/Ctrl+Shift+S` |
| Set mode: Viewing | `Cmd/Ctrl+Shift+D` |
| Add comment | `Cmd/Ctrl+Shift+M` |
| Submit comment | `Cmd/Ctrl+Shift+Enter` |

Additional commands available via the command palette:

- Accept/reject suggestion at cursor
- Accept/reject all suggestions
- Resolve all comments
- Strip markup (accept all changes)
- Strip markup (reject all changes)

## Settings

| Setting | Description | Default |
|---------|-------------|---------|
| Author name | Your name for comments and suggestions | (empty) |
| Default mode | Mode activated on plugin load | Editing |
| Show gutter markers | Display comment/suggestion indicators in the gutter | On |
