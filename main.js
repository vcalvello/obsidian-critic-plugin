var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => CriticPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian6 = require("obsidian");
var import_view5 = require("@codemirror/view");
var import_state19 = require("@codemirror/state");

// src/types.ts
var DEFAULT_SETTINGS = {
  authorName: "",
  defaultMode: "editing" /* EDITING */,
  showGutter: true
};

// src/editor/state.ts
var import_state = require("@codemirror/state");

// node_modules/nanoid/index.browser.js
var nanoid = (size = 21) => crypto.getRandomValues(new Uint8Array(size)).reduce((id, byte) => {
  byte &= 63;
  if (byte < 36) {
    id += byte.toString(36);
  } else if (byte < 62) {
    id += (byte - 26).toString(36).toUpperCase();
  } else if (byte > 62) {
    id += "-";
  } else {
    id += "_";
  }
  return id;
}, "");

// src/parser/critic-parser.ts
var PATTERNS = [
  { type: "addition" /* ADDITION */, regex: /\{\+\+([\s\S]*?)\+\+\}/g },
  { type: "deletion" /* DELETION */, regex: /\{--([\s\S]*?)--\}/g },
  { type: "substitution" /* SUBSTITUTION */, regex: /\{~~([\s\S]*?)~>([\s\S]*?)~~\}/g },
  { type: "comment" /* COMMENT */, regex: /\{>>([\s\S]*?)<<\}/g },
  { type: "highlight" /* HIGHLIGHT */, regex: /\{==([\s\S]*?)==\}/g }
];
var METADATA_SEPARATOR = "@@";
function parseMetadata(raw) {
  const separatorIndex = raw.indexOf(METADATA_SEPARATOR);
  if (separatorIndex === -1) {
    return { metadata: void 0, content: raw };
  }
  const jsonStr = raw.substring(0, separatorIndex);
  try {
    const parsed = JSON.parse(jsonStr);
    return {
      metadata: parsed,
      content: raw.substring(separatorIndex + METADATA_SEPARATOR.length)
    };
  } catch (e) {
    return { metadata: void 0, content: raw };
  }
}
function serializeMetadata(meta) {
  return JSON.stringify(meta) + METADATA_SEPARATOR;
}
function generateId() {
  return nanoid(8);
}
function parseCriticMarkup(text) {
  const ranges = [];
  for (const { type, regex } of PATTERNS) {
    regex.lastIndex = 0;
    let match;
    while ((match = regex.exec(text)) !== null) {
      const from = match.index;
      const to = from + match[0].length;
      if (type === "substitution" /* SUBSTITUTION */) {
        const rawOld = match[1];
        const rawNew = match[2];
        const { metadata, content: oldContent } = parseMetadata(rawOld);
        ranges.push({
          type,
          from,
          to,
          metadata,
          content: match[0],
          rawContent: rawOld,
          oldContent,
          newContent: rawNew
        });
      } else {
        const rawContent = match[1];
        const { metadata, content } = parseMetadata(rawContent);
        ranges.push({
          type,
          from,
          to,
          metadata,
          content,
          rawContent
        });
      }
    }
  }
  ranges.sort((a, b) => a.from - b.from);
  return ranges;
}
function createAddition(text, author) {
  const meta = serializeMetadata({
    id: generateId(),
    author,
    time: Math.floor(Date.now() / 1e3)
  });
  return `{++${meta}${text}++}`;
}
function createDeletion(text, author) {
  const meta = serializeMetadata({
    id: generateId(),
    author,
    time: Math.floor(Date.now() / 1e3)
  });
  return `{--${meta}${text}--}`;
}
function createSubstitution(oldText, newText, author) {
  const meta = serializeMetadata({
    id: generateId(),
    author,
    time: Math.floor(Date.now() / 1e3)
  });
  return `{~~${meta}${oldText}~>${newText}~~}`;
}
function createComment(text, author, replyTo) {
  const metaObj = {
    id: generateId(),
    author,
    time: Math.floor(Date.now() / 1e3)
  };
  if (replyTo)
    metaObj.replyTo = replyTo;
  const meta = serializeMetadata(metaObj);
  return `{>>${meta}${text}<<}`;
}
function createHighlight(text) {
  return `{==${text}==}`;
}
function updateMetadataInRange(range, updates) {
  const metaStart = range.from + 3;
  const sepIdx = range.rawContent.indexOf(METADATA_SEPARATOR);
  if (sepIdx === -1 || !range.metadata) {
    throw new Error("Cannot update metadata on a range without existing metadata");
  }
  const metaEnd = metaStart + sepIdx + METADATA_SEPARATOR.length;
  const newMeta = { ...range.metadata, ...updates };
  return { from: metaStart, to: metaEnd, insert: serializeMetadata(newMeta) };
}

// src/editor/state.ts
var criticRangesField = import_state.StateField.define({
  create(state) {
    return parseCriticMarkup(state.doc.toString());
  },
  update(ranges, tr) {
    if (tr.docChanged) {
      return parseCriticMarkup(tr.newDoc.toString());
    }
    return ranges;
  }
});

// src/editor/decorations.ts
var import_state4 = require("@codemirror/state");
var import_view2 = require("@codemirror/view");

// src/modes/mode-state.ts
var import_state2 = require("@codemirror/state");
var setModeEffect = import_state2.StateEffect.define();
var editorModeField = import_state2.StateField.define({
  create() {
    return "editing" /* EDITING */;
  },
  update(mode, tr) {
    for (const e of tr.effects) {
      if (e.is(setModeEffect))
        return e.value;
    }
    return mode;
  }
});
var suggestingModeCompartment = new import_state2.Compartment();
var readOnlyCompartment = new import_state2.Compartment();

// src/editor/focused-comment.ts
var import_state3 = require("@codemirror/state");
var setFocusedCommentEffect = import_state3.StateEffect.define();
var commentCreatedEffect = import_state3.StateEffect.define();
var focusedCommentField = import_state3.StateField.define({
  create() {
    return null;
  },
  update(current, tr) {
    for (const e of tr.effects) {
      if (e.is(setFocusedCommentEffect))
        return e.value;
    }
    return current;
  }
});

// src/editor/comment-indicator.ts
var import_obsidian = require("obsidian");
var import_view = require("@codemirror/view");
var CommentIndicatorWidget = class extends import_view.WidgetType {
  constructor(commentId, resolved) {
    super();
    this.commentId = commentId;
    this.resolved = resolved;
  }
  toDOM(view) {
    const span = document.createElement("span");
    span.className = "critic-comment-icon";
    if (this.resolved)
      span.classList.add("is-resolved");
    (0, import_obsidian.setIcon)(span, "message-square");
    span.setAttribute("aria-label", "Comment");
    span.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      view.dispatch({ effects: setFocusedCommentEffect.of(this.commentId) });
    });
    return span;
  }
  eq(other) {
    return this.commentId === other.commentId && this.resolved === other.resolved;
  }
  ignoreEvent() {
    return false;
  }
};

// src/editor/decorations.ts
var additionMark = import_view2.Decoration.mark({ class: "critic-addition" });
var additionFocusedMark = import_view2.Decoration.mark({ class: "critic-addition critic-suggestion-focused" });
var deletionMark = import_view2.Decoration.mark({ class: "critic-deletion" });
var deletionFocusedMark = import_view2.Decoration.mark({ class: "critic-deletion critic-suggestion-focused" });
var highlightMark = import_view2.Decoration.mark({ class: "critic-highlight" });
var highlightFocusedMark = import_view2.Decoration.mark({ class: "critic-highlight-focused" });
var highlightResolvedMark = import_view2.Decoration.mark({ class: "critic-highlight-resolved" });
var PlainTextWidget = class extends import_view2.WidgetType {
  constructor(text) {
    super();
    this.text = text;
  }
  toDOM() {
    const span = document.createElement("span");
    span.textContent = this.text;
    return span;
  }
  eq(other) {
    return this.text === other.text;
  }
};
function getContentOffsets(range) {
  var _a, _b, _c, _d;
  const metaSepIdx = range.rawContent.indexOf("@@");
  const metaPrefixLen = metaSepIdx >= 0 ? metaSepIdx + 2 : 0;
  if (range.type === "substitution" /* SUBSTITUTION */) {
    const oldStart = range.from + 3 + metaPrefixLen;
    const oldEnd = oldStart + ((_b = (_a = range.oldContent) == null ? void 0 : _a.length) != null ? _b : 0);
    const arrowEnd = oldEnd + 2;
    const newStart = arrowEnd;
    const newEnd = newStart + ((_d = (_c = range.newContent) == null ? void 0 : _c.length) != null ? _d : 0);
    return { oldStart, oldEnd, arrowEnd, newStart, newEnd };
  }
  const contentStart = range.from + 3 + metaPrefixLen;
  const contentEnd = contentStart + range.content.length;
  return { contentStart, contentEnd };
}
function hideRange(out, from, to) {
  if (from < to) {
    out.push({ from, to, decoration: import_view2.Decoration.replace({}) });
  }
}
function buildHighlightAnchorMap(ranges) {
  var _a;
  const map = /* @__PURE__ */ new Map();
  for (let i = 0; i < ranges.length; i++) {
    const r = ranges[i];
    if (r.type === "highlight" /* HIGHLIGHT */) {
      const next = ranges[i + 1];
      if (next && next.type === "comment" /* COMMENT */ && next.from === r.to && ((_a = next.metadata) == null ? void 0 : _a.id) && !next.metadata.replyTo) {
        map.set(next.metadata.id, r);
      }
    }
  }
  return map;
}
function getCommentStatus(ranges, commentId) {
  var _a;
  for (const r of ranges) {
    if (((_a = r.metadata) == null ? void 0 : _a.id) === commentId) {
      return r.metadata.status;
    }
  }
  return void 0;
}
function buildViewingDecorations(ranges) {
  var _a;
  const decs = [];
  for (const range of ranges) {
    switch (range.type) {
      case "addition" /* ADDITION */:
        decs.push({
          from: range.from,
          to: range.to,
          decoration: import_view2.Decoration.replace({})
        });
        break;
      case "deletion" /* DELETION */:
        decs.push({
          from: range.from,
          to: range.to,
          decoration: import_view2.Decoration.replace({
            widget: new PlainTextWidget(range.content)
          })
        });
        break;
      case "substitution" /* SUBSTITUTION */:
        decs.push({
          from: range.from,
          to: range.to,
          decoration: import_view2.Decoration.replace({
            widget: new PlainTextWidget((_a = range.oldContent) != null ? _a : "")
          })
        });
        break;
      case "highlight" /* HIGHLIGHT */:
        decs.push({
          from: range.from,
          to: range.to,
          decoration: import_view2.Decoration.replace({
            widget: new PlainTextWidget(range.content)
          })
        });
        break;
      case "comment" /* COMMENT */:
        decs.push({
          from: range.from,
          to: range.to,
          decoration: import_view2.Decoration.replace({})
        });
        break;
    }
  }
  decs.sort((a, b) => a.from - b.from || a.to - b.to);
  const merged = [];
  for (const d of decs) {
    const last = merged[merged.length - 1];
    if (last && d.from < last.to) {
      if (d.to > last.to) {
        last.to = d.to;
        last.decoration = d.decoration;
      }
    } else {
      merged.push({ from: d.from, to: d.to, decoration: d.decoration });
    }
  }
  return import_view2.Decoration.set(
    merged.map((d) => d.decoration.range(d.from, d.to)),
    true
  );
}
function buildEditingDecorations(ranges, focusedId) {
  var _a, _b, _c, _d;
  const decs = [];
  const anchorMap = buildHighlightAnchorMap(ranges);
  const anchoredHighlights = /* @__PURE__ */ new Set();
  for (const h of anchorMap.values()) {
    anchoredHighlights.add(h);
  }
  const highlightToCommentId = /* @__PURE__ */ new Map();
  for (const [commentId, highlight] of anchorMap.entries()) {
    highlightToCommentId.set(highlight, commentId);
  }
  for (const range of ranges) {
    switch (range.type) {
      case "addition" /* ADDITION */: {
        const o = getContentOffsets(range);
        if ("contentStart" in o) {
          const isFocused = ((_a = range.metadata) == null ? void 0 : _a.id) && focusedId === range.metadata.id;
          hideRange(decs, range.from, o.contentStart);
          if (o.contentStart < o.contentEnd) {
            decs.push({ from: o.contentStart, to: o.contentEnd, decoration: isFocused ? additionFocusedMark : additionMark });
          }
          hideRange(decs, o.contentEnd, range.to);
        }
        break;
      }
      case "deletion" /* DELETION */: {
        const o = getContentOffsets(range);
        if ("contentStart" in o) {
          const isFocused = ((_b = range.metadata) == null ? void 0 : _b.id) && focusedId === range.metadata.id;
          hideRange(decs, range.from, o.contentStart);
          if (o.contentStart < o.contentEnd) {
            decs.push({ from: o.contentStart, to: o.contentEnd, decoration: isFocused ? deletionFocusedMark : deletionMark });
          }
          hideRange(decs, o.contentEnd, range.to);
        }
        break;
      }
      case "substitution" /* SUBSTITUTION */: {
        const o = getContentOffsets(range);
        if ("oldStart" in o) {
          const isFocused = ((_c = range.metadata) == null ? void 0 : _c.id) && focusedId === range.metadata.id;
          hideRange(decs, range.from, o.oldStart);
          if (o.oldStart < o.oldEnd) {
            decs.push({ from: o.oldStart, to: o.oldEnd, decoration: isFocused ? deletionFocusedMark : deletionMark });
          }
          hideRange(decs, o.oldEnd, o.arrowEnd);
          if (o.newStart < o.newEnd) {
            decs.push({ from: o.newStart, to: o.newEnd, decoration: isFocused ? additionFocusedMark : additionMark });
          }
          hideRange(decs, o.newEnd, range.to);
        }
        break;
      }
      case "highlight" /* HIGHLIGHT */: {
        const o = getContentOffsets(range);
        if ("contentStart" in o) {
          const commentId = highlightToCommentId.get(range);
          if (commentId) {
            const resolved = getCommentStatus(ranges, commentId) === "resolved";
            let mark;
            if (focusedId === commentId) {
              mark = highlightFocusedMark;
            } else if (resolved) {
              mark = highlightResolvedMark;
            } else {
              mark = highlightMark;
            }
            hideRange(decs, range.from, o.contentStart);
            if (o.contentStart < o.contentEnd) {
              decs.push({ from: o.contentStart, to: o.contentEnd, decoration: mark });
            }
            hideRange(decs, o.contentEnd, range.to);
          } else {
            hideRange(decs, range.from, o.contentStart);
            if (o.contentStart < o.contentEnd) {
              decs.push({ from: o.contentStart, to: o.contentEnd, decoration: highlightMark });
            }
            hideRange(decs, o.contentEnd, range.to);
          }
        }
        break;
      }
      case "comment" /* COMMENT */: {
        if (((_d = range.metadata) == null ? void 0 : _d.id) && !range.metadata.replyTo && !anchorMap.has(range.metadata.id)) {
          const resolved = range.metadata.status === "resolved";
          const widget = new CommentIndicatorWidget(range.metadata.id, resolved);
          decs.push({
            from: range.from,
            to: range.from,
            decoration: import_view2.Decoration.widget({ widget, side: 1 })
          });
        }
        hideRange(decs, range.from, range.to);
        break;
      }
    }
  }
  return import_view2.Decoration.set(
    decs.map((d) => d.decoration.range(d.from, d.to)),
    true
  );
}
var criticDecorationsField = import_state4.StateField.define({
  create(state) {
    var _a;
    const ranges = state.field(criticRangesField);
    const mode = state.field(editorModeField);
    try {
      if (mode === "viewing" /* VIEWING */) {
        return buildViewingDecorations(ranges);
      }
      const focusedId = (_a = state.field(focusedCommentField, false)) != null ? _a : null;
      return buildEditingDecorations(ranges, focusedId);
    } catch (e) {
      console.error("[CriticMarkup] decoration error:", e);
      return import_view2.Decoration.none;
    }
  },
  update(decorations, tr) {
    var _a;
    const ranges = tr.state.field(criticRangesField);
    const mode = tr.state.field(editorModeField);
    try {
      if (mode === "viewing" /* VIEWING */) {
        return buildViewingDecorations(ranges);
      }
      const focusedId = (_a = tr.state.field(focusedCommentField, false)) != null ? _a : null;
      return buildEditingDecorations(ranges, focusedId);
    } catch (e) {
      console.error("[CriticMarkup] decoration error:", e);
      return import_view2.Decoration.none;
    }
  },
  provide(field) {
    return import_view2.EditorView.decorations.from(field);
  }
});

// src/modes/suggesting-mode.ts
var import_state6 = require("@codemirror/state");
function findOwnAdditionAtPos(state, pos, author) {
  var _a;
  const ranges = state.field(criticRangesField);
  for (const range of ranges) {
    if (range.type !== "addition" /* ADDITION */)
      continue;
    if (((_a = range.metadata) == null ? void 0 : _a.author) !== author)
      continue;
    const metaSepIdx = range.rawContent.indexOf("@@");
    const metaPrefixLen = metaSepIdx >= 0 ? metaSepIdx + 2 : 0;
    const contentStart = range.from + 3 + metaPrefixLen;
    const contentEnd = contentStart + range.content.length;
    if (pos >= contentStart && pos <= contentEnd) {
      return { range, contentStart, contentEnd };
    }
  }
  return void 0;
}
function findOwnDeletionAtPos(state, pos, author) {
  var _a;
  const ranges = state.field(criticRangesField);
  for (const range of ranges) {
    if (range.type !== "deletion" /* DELETION */)
      continue;
    if (((_a = range.metadata) == null ? void 0 : _a.author) !== author)
      continue;
    const metaSepIdx = range.rawContent.indexOf("@@");
    const metaPrefixLen = metaSepIdx >= 0 ? metaSepIdx + 2 : 0;
    const contentStart = range.from + 3 + metaPrefixLen;
    const contentEnd = contentStart + range.content.length;
    if (pos >= contentStart && pos <= contentEnd) {
      return { range, contentStart, contentEnd };
    }
  }
  return void 0;
}
function suggestingModeFilter(author) {
  return import_state6.EditorState.transactionFilter.of((tr) => {
    if (!tr.docChanged)
      return tr;
    const userEvent = tr.annotation(import_state6.Transaction.userEvent);
    if (!userEvent)
      return tr;
    const isInput = userEvent.startsWith("input");
    const isDelete = userEvent.startsWith("delete");
    const isPaste = userEvent.startsWith("input.paste");
    const isMove = userEvent.startsWith("move");
    if (!isInput && !isDelete && !isPaste && !isMove)
      return tr;
    const changes = [];
    tr.changes.iterChanges((fromA, toA, fromB, toB, inserted) => {
      changes.push({ fromA, toA, inserted: inserted.toString() });
    });
    if (changes.length === 0)
      return tr;
    const specs = [];
    let offset = 0;
    for (const change of changes) {
      const { fromA, toA, inserted } = change;
      const deletedText = tr.startState.doc.sliceString(fromA, toA);
      const hasInsertion = inserted.length > 0;
      const hasDeletion = deletedText.length > 0;
      if (hasInsertion && !hasDeletion) {
        const ownAddition = findOwnAdditionAtPos(tr.startState, fromA, author);
        if (ownAddition) {
          return tr;
        }
      }
      if (hasDeletion && !hasInsertion) {
        const ownAddition = findOwnAdditionAtPos(tr.startState, fromA, author);
        if (ownAddition && fromA >= ownAddition.contentStart && toA <= ownAddition.contentEnd) {
          return tr;
        }
      }
      if (hasDeletion && !hasInsertion) {
        const ownDeletion = findOwnDeletionAtPos(tr.startState, fromA, author);
        if (ownDeletion) {
          return tr;
        }
      }
      let replacement;
      let cursorOffset;
      if (hasInsertion && hasDeletion) {
        replacement = createSubstitution(deletedText, inserted, author);
        cursorOffset = replacement.length - 3;
      } else if (hasInsertion) {
        replacement = createAddition(inserted, author);
        cursorOffset = replacement.length - 3;
      } else {
        replacement = createDeletion(deletedText, author);
        cursorOffset = replacement.length;
      }
      specs.push({
        changes: {
          from: fromA + offset,
          to: toA + offset,
          insert: replacement
        },
        selection: {
          anchor: fromA + offset + cursorOffset
        }
      });
      offset += replacement.length - (toA - fromA);
    }
    if (specs.length === 0)
      return tr;
    const spec = specs[0];
    return tr.startState.update({
      ...spec,
      annotations: import_state6.Transaction.userEvent.of("critic.suggest")
    });
  });
}

// src/commands/accept-reject.ts
var import_state8 = require("@codemirror/state");
function getAcceptText(range) {
  var _a;
  switch (range.type) {
    case "addition" /* ADDITION */:
      return range.content;
    case "deletion" /* DELETION */:
      return "";
    case "substitution" /* SUBSTITUTION */:
      return (_a = range.newContent) != null ? _a : "";
    default:
      return "";
  }
}
function getRejectText(range) {
  var _a;
  switch (range.type) {
    case "addition" /* ADDITION */:
      return "";
    case "deletion" /* DELETION */:
      return range.content;
    case "substitution" /* SUBSTITUTION */:
      return (_a = range.oldContent) != null ? _a : "";
    default:
      return "";
  }
}
function isSuggestion(range) {
  return range.type === "addition" /* ADDITION */ || range.type === "deletion" /* DELETION */ || range.type === "substitution" /* SUBSTITUTION */;
}
function findSuggestionAtCursor(state) {
  const ranges = state.field(criticRangesField);
  const cursor = state.selection.main.head;
  for (const range of ranges) {
    if (!isSuggestion(range))
      continue;
    if (cursor >= range.from && cursor <= range.to) {
      return range;
    }
  }
  return void 0;
}
function acceptSuggestion(view, range) {
  const replacement = getAcceptText(range);
  view.dispatch({
    changes: { from: range.from, to: range.to, insert: replacement },
    annotations: import_state8.Transaction.userEvent.of("critic.accept")
  });
}
function rejectSuggestion(view, range) {
  const replacement = getRejectText(range);
  view.dispatch({
    changes: { from: range.from, to: range.to, insert: replacement },
    annotations: import_state8.Transaction.userEvent.of("critic.reject")
  });
}
function acceptAllSuggestions(view) {
  const ranges = view.state.field(criticRangesField);
  const suggestions = ranges.filter(isSuggestion);
  if (suggestions.length === 0)
    return;
  const changes = [...suggestions].reverse().map((range) => ({
    from: range.from,
    to: range.to,
    insert: getAcceptText(range)
  }));
  view.dispatch({
    changes,
    annotations: import_state8.Transaction.userEvent.of("critic.accept-all")
  });
}
function rejectAllSuggestions(view) {
  const ranges = view.state.field(criticRangesField);
  const suggestions = ranges.filter(isSuggestion);
  if (suggestions.length === 0)
    return;
  const changes = [...suggestions].reverse().map((range) => ({
    from: range.from,
    to: range.to,
    insert: getRejectText(range)
  }));
  view.dispatch({
    changes,
    annotations: import_state8.Transaction.userEvent.of("critic.reject-all")
  });
}

// src/settings/settings-tab.ts
var import_obsidian2 = require("obsidian");
var CriticSettingTab = class extends import_obsidian2.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    new import_obsidian2.Setting(containerEl).setName("Author name").setDesc("Your name for comments and suggestions").addText(
      (text) => text.setPlaceholder("e.g. Victor").setValue(this.plugin.settings.authorName).onChange(async (value) => {
        this.plugin.settings.authorName = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian2.Setting(containerEl).setName("Default mode").setDesc("Mode to activate when opening the plugin (takes effect after reloading the plugin)").addDropdown(
      (dropdown) => dropdown.addOption("editing" /* EDITING */, "Editing").addOption("suggesting" /* SUGGESTING */, "Suggesting").addOption("viewing" /* VIEWING */, "Viewing").setValue(this.plugin.settings.defaultMode).onChange(async (value) => {
        this.plugin.settings.defaultMode = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian2.Setting(containerEl).setName("Show gutter markers").setDesc("Display comment and suggestion indicators in the gutter").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.showGutter).onChange(async (value) => {
        this.plugin.settings.showGutter = value;
        await this.plugin.saveSettings();
        this.plugin.reconfigureGutter();
      })
    );
  }
};

// src/editor/floating-toolbar.ts
var import_state10 = require("@codemirror/state");
var authorNameFacet = import_state10.Facet.define({
  combine(values) {
    var _a;
    return (_a = values[values.length - 1]) != null ? _a : "";
  }
});

// src/sidebar/comments-panel.ts
var import_obsidian4 = require("obsidian");

// src/comments/threads.ts
function buildThreads(ranges) {
  var _a, _b, _c, _d, _e, _f, _g, _h;
  const byId = /* @__PURE__ */ new Map();
  for (const r of ranges) {
    if ((_a = r.metadata) == null ? void 0 : _a.id) {
      byId.set(r.metadata.id, r);
    }
  }
  const highlights = ranges.filter((r) => r.type === "highlight" /* HIGHLIGHT */);
  const rootComments = ranges.filter(
    (r) => r.type === "comment" /* COMMENT */ && r.metadata && !r.metadata.replyTo
  );
  const rootSuggestions = ranges.filter(
    (r) => {
      var _a2;
      return (r.type === "addition" /* ADDITION */ || r.type === "deletion" /* DELETION */ || r.type === "substitution" /* SUBSTITUTION */) && ((_a2 = r.metadata) == null ? void 0 : _a2.id);
    }
  );
  const repliesByParent = /* @__PURE__ */ new Map();
  for (const r of ranges) {
    if (r.type === "comment" /* COMMENT */ && ((_b = r.metadata) == null ? void 0 : _b.replyTo)) {
      const parentId = r.metadata.replyTo;
      if (!repliesByParent.has(parentId)) {
        repliesByParent.set(parentId, []);
      }
      repliesByParent.get(parentId).push(r);
    }
  }
  for (const replies of repliesByParent.values()) {
    replies.sort((a, b) => {
      var _a2, _b2, _c2, _d2;
      return ((_b2 = (_a2 = a.metadata) == null ? void 0 : _a2.time) != null ? _b2 : 0) - ((_d2 = (_c2 = b.metadata) == null ? void 0 : _c2.time) != null ? _d2 : 0);
    });
  }
  const threads = [];
  for (const root of rootComments) {
    const id = root.metadata.id;
    const anchor = highlights.find((h) => h.to === root.from);
    const replies = (_c = repliesByParent.get(id)) != null ? _c : [];
    const status = (_e = (_d = root.metadata) == null ? void 0 : _d.status) != null ? _e : "open";
    threads.push({ id, anchor, root, replies, type: "comment", status });
  }
  for (const root of rootSuggestions) {
    const id = root.metadata.id;
    const replies = (_f = repliesByParent.get(id)) != null ? _f : [];
    const status = (_h = (_g = root.metadata) == null ? void 0 : _g.status) != null ? _h : "open";
    threads.push({ id, root, replies, type: "suggestion", status });
  }
  threads.sort((a, b) => {
    var _a2, _b2, _c2, _d2;
    const posA = (_b2 = (_a2 = a.anchor) == null ? void 0 : _a2.from) != null ? _b2 : a.root.from;
    const posB = (_d2 = (_c2 = b.anchor) == null ? void 0 : _c2.from) != null ? _d2 : b.root.from;
    return posA - posB;
  });
  return threads;
}

// src/sidebar/comment-card.ts
var import_obsidian3 = require("obsidian");
function relativeTime(timestamp) {
  const now = Math.floor(Date.now() / 1e3);
  const diff = now - timestamp;
  if (diff < 60)
    return "just now";
  if (diff < 3600)
    return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)
    return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800)
    return `${Math.floor(diff / 86400)}d ago`;
  const date = new Date(timestamp * 1e3);
  return date.toLocaleDateString();
}
function authorInitial(author) {
  return (author != null ? author : "?")[0].toUpperCase();
}
function autoResize(textarea) {
  textarea.style.height = "auto";
  textarea.style.height = textarea.scrollHeight + "px";
}
function setupTextarea(textarea, onSubmit) {
  textarea.rows = 1;
  textarea.addEventListener("input", () => autoResize(textarea));
  textarea.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      onSubmit();
    }
  }, true);
  textarea.addEventListener("critic-submit", () => {
    onSubmit();
  });
  requestAnimationFrame(() => autoResize(textarea));
}
function iconButton(iconName, title, onClick) {
  const btn = document.createElement("button");
  btn.setAttribute("aria-label", title);
  btn.title = title;
  (0, import_obsidian3.setIcon)(btn, iconName);
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    onClick(e);
  });
  return btn;
}
function renderCard(thread, callbacks, focusedId, isPending, draftText, replyDraftText) {
  var _a, _b, _c, _d, _e, _f, _g, _h;
  const card = document.createElement("div");
  card.className = "critic-card";
  card.dataset.threadId = thread.id;
  if (thread.status === "resolved")
    card.classList.add("is-resolved");
  if (focusedId === thread.id)
    card.classList.add("is-focused");
  card.addEventListener("click", () => callbacks.onFocus(thread));
  if (thread.anchor) {
    const anchorEl = document.createElement("div");
    anchorEl.className = "critic-card-anchor";
    const text = thread.anchor.content;
    anchorEl.textContent = text.length > 80 ? text.slice(0, 80) + "..." : text;
    card.appendChild(anchorEl);
  }
  if (thread.type === "suggestion") {
    const sugEl = document.createElement("div");
    sugEl.className = "critic-card-suggestion";
    if (thread.root.oldContent !== void 0) {
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
  const header = document.createElement("div");
  header.className = "critic-card-header";
  const avatar = document.createElement("span");
  avatar.className = "critic-card-avatar";
  avatar.textContent = authorInitial((_a = thread.root.metadata) == null ? void 0 : _a.author);
  header.appendChild(avatar);
  const authorSpan = document.createElement("span");
  authorSpan.className = "critic-card-author";
  authorSpan.textContent = (_c = (_b = thread.root.metadata) == null ? void 0 : _b.author) != null ? _c : "Unknown";
  header.appendChild(authorSpan);
  const timeSpan = document.createElement("span");
  timeSpan.className = "critic-card-time";
  timeSpan.textContent = ((_d = thread.root.metadata) == null ? void 0 : _d.time) ? relativeTime(thread.root.metadata.time) : "";
  header.appendChild(timeSpan);
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
  if (isPending) {
    const inputContainer = document.createElement("div");
    inputContainer.className = "critic-card-input";
    const textarea = document.createElement("textarea");
    textarea.placeholder = "Write a comment...";
    if (draftText)
      textarea.value = draftText;
    textarea.addEventListener("click", (e) => e.stopPropagation());
    inputContainer.appendChild(textarea);
    const submitComment = () => {
      const text = textarea.value.trim();
      if (text) {
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
    if (!draftText) {
      setTimeout(() => textarea.focus(), 0);
    }
    textarea.addEventListener("blur", () => {
      setTimeout(() => {
        if (!textarea.isConnected)
          return;
        if (!textarea.value.trim()) {
          callbacks.onCancelEmpty(thread);
        }
      }, 200);
    });
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
      replyAvatar.textContent = authorInitial((_e = reply.metadata) == null ? void 0 : _e.author);
      replyAvatar.style.width = "20px";
      replyAvatar.style.height = "20px";
      replyAvatar.style.fontSize = "10px";
      replyHeader.appendChild(replyAvatar);
      const replyAuthor = document.createElement("span");
      replyAuthor.className = "critic-card-reply-author";
      replyAuthor.textContent = (_g = (_f = reply.metadata) == null ? void 0 : _f.author) != null ? _g : "Unknown";
      replyHeader.appendChild(replyAuthor);
      const replyTime = document.createElement("span");
      replyTime.className = "critic-card-reply-time";
      replyTime.textContent = ((_h = reply.metadata) == null ? void 0 : _h.time) ? relativeTime(reply.metadata.time) : "";
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
  if (!isPending && thread.status !== "resolved") {
    const replyContainer = document.createElement("div");
    replyContainer.className = "critic-card-input";
    const replyTextarea = document.createElement("textarea");
    replyTextarea.placeholder = "Reply...";
    if (replyDraftText)
      replyTextarea.value = replyDraftText;
    replyTextarea.addEventListener("click", (e) => e.stopPropagation());
    replyContainer.appendChild(replyTextarea);
    const submitReply = () => {
      const text = replyTextarea.value.trim();
      if (text) {
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

// src/sidebar/filters.ts
function filterThreads(threads, filter, searchQuery) {
  let result = threads;
  if (filter === "open") {
    result = result.filter((t) => t.status === "open");
  } else if (filter === "resolved") {
    result = result.filter((t) => t.status === "resolved");
  }
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    result = result.filter((t) => {
      var _a, _b, _c, _d, _e, _f, _g;
      if (t.root.content.toLowerCase().includes(q))
        return true;
      if ((_b = (_a = t.root.metadata) == null ? void 0 : _a.author) == null ? void 0 : _b.toLowerCase().includes(q))
        return true;
      if ((_c = t.anchor) == null ? void 0 : _c.content.toLowerCase().includes(q))
        return true;
      if ((_d = t.root.oldContent) == null ? void 0 : _d.toLowerCase().includes(q))
        return true;
      if ((_e = t.root.newContent) == null ? void 0 : _e.toLowerCase().includes(q))
        return true;
      for (const reply of t.replies) {
        if (reply.content.toLowerCase().includes(q))
          return true;
        if ((_g = (_f = reply.metadata) == null ? void 0 : _f.author) == null ? void 0 : _g.toLowerCase().includes(q))
          return true;
      }
      return false;
    });
  }
  return result;
}

// src/sidebar/comments-panel.ts
var COMMENTS_VIEW_TYPE = "critic-comments";
var CARD_RENDER_LIMIT = 50;
var CommentsPanel = class extends import_obsidian4.ItemView {
  constructor(leaf) {
    super(leaf);
    this.threads = [];
    this.filter = "all";
    this.searchQuery = "";
    this.focusedId = null;
    this.displayLimit = CARD_RENDER_LIMIT;
    /** Set of comment IDs that are in pending/draft state (showing textarea). */
    this.pendingCommentIds = /* @__PURE__ */ new Set();
    /** Saved textarea content for drafts, keyed by comment ID. */
    this.draftTexts = /* @__PURE__ */ new Map();
    /** Saved reply textarea content for reply drafts, keyed by thread ID. */
    this.replyDraftTexts = /* @__PURE__ */ new Map();
    this.callbacks = null;
    this.listEl = null;
    this.headerCountEl = null;
    this.filterSelectEl = null;
    this.searchInputEl = null;
  }
  getViewType() {
    return COMMENTS_VIEW_TYPE;
  }
  getDisplayText() {
    return "Comments";
  }
  getIcon() {
    return "message-square";
  }
  setCallbacks(callbacks) {
    this.callbacks = callbacks;
  }
  async onOpen() {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass("critic-panel");
    const header = container.createDiv({ cls: "critic-panel-header" });
    const titleEl = header.createDiv({ cls: "critic-panel-title" });
    titleEl.createEl("h4", { text: "Comments" });
    this.headerCountEl = titleEl.createSpan({ cls: "critic-panel-count" });
    const actions = header.createDiv({ cls: "critic-panel-header-actions" });
    const acceptAllBtn = actions.createEl("button", { attr: { "aria-label": "Accept all suggestions" } });
    (0, import_obsidian4.setIcon)(acceptAllBtn, "check-check");
    acceptAllBtn.addEventListener("click", () => {
      var _a, _b;
      return (_b = (_a = this.callbacks) == null ? void 0 : _a.onAcceptAll) == null ? void 0 : _b.call(_a);
    });
    const rejectAllBtn = actions.createEl("button", { attr: { "aria-label": "Reject all suggestions" } });
    (0, import_obsidian4.setIcon)(rejectAllBtn, "x");
    rejectAllBtn.addEventListener("click", () => {
      var _a, _b;
      return (_b = (_a = this.callbacks) == null ? void 0 : _a.onRejectAll) == null ? void 0 : _b.call(_a);
    });
    const resolveAllBtn = actions.createEl("button", { attr: { "aria-label": "Resolve all comments" } });
    (0, import_obsidian4.setIcon)(resolveAllBtn, "check-circle-2");
    resolveAllBtn.addEventListener("click", () => {
      var _a, _b;
      return (_b = (_a = this.callbacks) == null ? void 0 : _a.onResolveAll) == null ? void 0 : _b.call(_a);
    });
    const filters = container.createDiv({ cls: "critic-panel-filters" });
    this.filterSelectEl = filters.createEl("select");
    for (const [value, label] of [
      ["all", "All"],
      ["open", "Open"],
      ["resolved", "Resolved"]
    ]) {
      const opt = this.filterSelectEl.createEl("option", { text: label, value });
      if (value === this.filter)
        opt.selected = true;
    }
    this.filterSelectEl.addEventListener("change", () => {
      this.filter = this.filterSelectEl.value;
      this.displayLimit = CARD_RENDER_LIMIT;
      this.renderCards();
    });
    this.searchInputEl = filters.createEl("input", {
      type: "text",
      placeholder: "Search..."
    });
    this.searchInputEl.addEventListener("input", () => {
      this.searchQuery = this.searchInputEl.value;
      this.displayLimit = CARD_RENDER_LIMIT;
      this.renderCards();
    });
    this.listEl = container.createDiv({ cls: "critic-panel-list" });
    this.renderCards();
  }
  async onClose() {
  }
  /**
   * Called by the plugin when ranges change. Rebuilds threads and re-renders.
   */
  update(ranges) {
    this.threads = buildThreads(ranges);
    this.renderCards();
  }
  /**
   * Set the focused comment ID and re-render.
   */
  setFocusedId(id) {
    this.focusedId = id;
    this.renderCards();
  }
  /**
   * Add a comment ID to the pending/draft set and re-render.
   */
  setPendingComment(commentId) {
    if (commentId) {
      this.pendingCommentIds.add(commentId);
    }
    this.renderCards();
  }
  /**
   * Remove a comment from the pending/draft set (after save or cancel).
   */
  removePendingComment(commentId) {
    this.pendingCommentIds.delete(commentId);
    this.draftTexts.delete(commentId);
    this.renderCards();
  }
  /**
   * Focus a card: scroll to it and expand it.
   */
  focusCard(commentId) {
    var _a;
    this.focusedId = commentId;
    const filtered = filterThreads(this.threads, this.filter, this.searchQuery);
    const idx = filtered.findIndex((t) => t.id === commentId);
    if (idx >= this.displayLimit) {
      this.displayLimit = idx + CARD_RENDER_LIMIT;
    }
    this.renderCards();
    const cardEl = (_a = this.listEl) == null ? void 0 : _a.querySelector(`[data-thread-id="${commentId}"]`);
    if (cardEl) {
      cardEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
      const textarea = cardEl.querySelector(".critic-card-input textarea");
      if (textarea && textarea.value.trim()) {
        setTimeout(() => textarea.focus(), 0);
      }
    }
  }
  /**
   * Save textarea content from currently rendered draft cards before re-rendering.
   */
  saveDraftTexts() {
    if (!this.listEl)
      return;
    const cards = this.listEl.querySelectorAll(".critic-card");
    for (const card of cards) {
      const threadId = card.dataset.threadId;
      if (!threadId)
        continue;
      const isPending = this.pendingCommentIds.has(threadId);
      const textareas = card.querySelectorAll(".critic-card-input textarea");
      for (const textarea of textareas) {
        const map = isPending ? this.draftTexts : this.replyDraftTexts;
        if (textarea.value) {
          map.set(threadId, textarea.value);
        } else {
          map.delete(threadId);
        }
      }
    }
  }
  renderCards() {
    if (!this.listEl || !this.callbacks)
      return;
    this.saveDraftTexts();
    const scrollTop = this.listEl.scrollTop;
    this.listEl.empty();
    const filtered = filterThreads(this.threads, this.filter, this.searchQuery);
    if (this.headerCountEl) {
      this.headerCountEl.textContent = filtered.length > 0 ? `${filtered.length}` : "";
    }
    if (filtered.length === 0) {
      const empty = this.listEl.createDiv({ cls: "critic-panel-empty" });
      empty.textContent = this.threads.length === 0 ? "No comments yet" : "No matching comments";
      return;
    }
    const visible = filtered.slice(0, this.displayLimit);
    for (const thread of visible) {
      const isPending = this.pendingCommentIds.has(thread.id);
      const draftText = this.draftTexts.get(thread.id);
      const replyDraftText = this.replyDraftTexts.get(thread.id);
      const card = renderCard(thread, this.callbacks, this.focusedId, isPending, draftText, replyDraftText);
      this.listEl.appendChild(card);
    }
    const remaining = filtered.length - visible.length;
    if (remaining > 0) {
      const showMoreBtn = this.listEl.createDiv({ cls: "critic-panel-show-more" });
      showMoreBtn.textContent = `Show ${remaining} more...`;
      showMoreBtn.addEventListener("click", () => {
        this.displayLimit += CARD_RENDER_LIMIT;
        this.renderCards();
      });
    }
    this.listEl.scrollTop = scrollTop;
  }
};

// src/comments/create-comment.ts
var import_state11 = require("@codemirror/state");
function addComment(view, author) {
  const { from, to } = view.state.selection.main;
  const commentId = generateId();
  const meta = serializeMetadata({
    id: commentId,
    author,
    time: Math.floor(Date.now() / 1e3)
  });
  let insert;
  let replaceFrom;
  let replaceTo;
  if (from < to) {
    const selectedText = view.state.sliceDoc(from, to);
    insert = createHighlight(selectedText) + `{>>${meta}<<}`;
    replaceFrom = from;
    replaceTo = to;
  } else {
    insert = `{>>${meta}<<}`;
    replaceFrom = from;
    replaceTo = from;
  }
  view.dispatch({
    changes: { from: replaceFrom, to: replaceTo, insert },
    annotations: import_state11.Transaction.userEvent.of("critic.comment"),
    effects: setFocusedCommentEffect.of(commentId)
  });
  return commentId;
}
function saveCommentText(view, commentId, text) {
  const ranges = view.state.field(criticRangesField);
  const range = ranges.find(
    (r) => {
      var _a;
      return r.type === "comment" /* COMMENT */ && ((_a = r.metadata) == null ? void 0 : _a.id) === commentId;
    }
  );
  if (!range)
    return;
  const docText = view.state.sliceDoc(range.from, range.to);
  const sepIdx = docText.indexOf("@@");
  if (sepIdx === -1)
    return;
  const insertPos = range.from + sepIdx + 2;
  const closeIdx = docText.lastIndexOf("<<}");
  const currentContentEnd = range.from + closeIdx;
  view.dispatch({
    changes: { from: insertPos, to: currentContentEnd, insert: text },
    annotations: import_state11.Transaction.userEvent.of("critic.comment.save")
  });
}
function cancelEmptyComment(view, commentId) {
  const ranges = view.state.field(criticRangesField);
  const commentRange = ranges.find(
    (r) => {
      var _a;
      return r.type === "comment" /* COMMENT */ && ((_a = r.metadata) == null ? void 0 : _a.id) === commentId;
    }
  );
  if (!commentRange)
    return;
  const anchorRange = ranges.find(
    (r) => r.type === "highlight" /* HIGHLIGHT */ && r.to === commentRange.from
  );
  const changes = [];
  if (anchorRange) {
    changes.push({
      from: anchorRange.from,
      to: commentRange.to,
      insert: anchorRange.content
    });
  } else {
    changes.push({
      from: commentRange.from,
      to: commentRange.to,
      insert: ""
    });
  }
  view.dispatch({
    changes,
    annotations: import_state11.Transaction.userEvent.of("critic.comment.cancel"),
    effects: setFocusedCommentEffect.of(null)
  });
}
function addReply(view, parentId, text, author) {
  const ranges = view.state.field(criticRangesField);
  const threadRanges = ranges.filter(
    (r) => {
      var _a, _b;
      return r.type === "comment" /* COMMENT */ && (((_a = r.metadata) == null ? void 0 : _a.id) === parentId || ((_b = r.metadata) == null ? void 0 : _b.replyTo) === parentId);
    }
  );
  if (threadRanges.length === 0)
    return;
  const lastRange = threadRanges[threadRanges.length - 1];
  const reply = createComment(text, author, parentId);
  view.dispatch({
    changes: { from: lastRange.to, to: lastRange.to, insert: reply },
    annotations: import_state11.Transaction.userEvent.of("critic.comment.reply")
  });
}

// src/comments/resolve.ts
var import_state13 = require("@codemirror/state");
function resolveComment(view, range) {
  if (!range.metadata)
    return;
  const change = updateMetadataInRange(range, { status: "resolved" });
  view.dispatch({
    changes: change,
    annotations: import_state13.Transaction.userEvent.of("critic.comment.resolve")
  });
}
function reopenComment(view, range) {
  if (!range.metadata)
    return;
  const change = updateMetadataInRange(range, { status: "open" });
  view.dispatch({
    changes: change,
    annotations: import_state13.Transaction.userEvent.of("critic.comment.reopen")
  });
}
function resolveAllComments(view) {
  const ranges = view.state.field(criticRangesField);
  const openComments = ranges.filter(
    (r) => r.type === "comment" /* COMMENT */ && r.metadata && !r.metadata.replyTo && r.metadata.status !== "resolved"
  );
  if (openComments.length === 0)
    return;
  const changes = [...openComments].reverse().map((r) => updateMetadataInRange(r, { status: "resolved" }));
  view.dispatch({
    changes,
    annotations: import_state13.Transaction.userEvent.of("critic.comment.resolve-all")
  });
}

// src/editor/gutter-markers.ts
var import_obsidian5 = require("obsidian");
var import_state15 = require("@codemirror/state");
var import_view3 = require("@codemirror/view");
var gutterCompartment = new import_state15.Compartment();
var CommentGutterMarker = class _CommentGutterMarker extends import_view3.GutterMarker {
  constructor(commentId, resolved) {
    super();
    this.commentId = commentId;
    this.resolved = resolved;
  }
  toDOM(view) {
    const el = document.createElement("div");
    el.className = "critic-gutter-comment";
    if (this.resolved)
      el.classList.add("is-resolved");
    (0, import_obsidian5.setIcon)(el, "message-circle");
    el.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      view.dispatch({ effects: setFocusedCommentEffect.of(this.commentId) });
    });
    return el;
  }
  eq(other) {
    return other instanceof _CommentGutterMarker && this.commentId === other.commentId && this.resolved === other.resolved;
  }
};
var SuggestionGutterMarker = class _SuggestionGutterMarker extends import_view3.GutterMarker {
  constructor(suggestionId) {
    super();
    this.suggestionId = suggestionId;
  }
  toDOM(view) {
    const el = document.createElement("div");
    el.className = "critic-gutter-suggestion";
    el.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      view.dispatch({ effects: setFocusedCommentEffect.of(this.suggestionId) });
    });
    return el;
  }
  eq(other) {
    return other instanceof _SuggestionGutterMarker && this.suggestionId === other.suggestionId;
  }
};
function buildHighlightAnchorMap2(ranges) {
  var _a;
  const map = /* @__PURE__ */ new Map();
  for (let i = 0; i < ranges.length; i++) {
    const r = ranges[i];
    if (r.type === "highlight" /* HIGHLIGHT */) {
      const next = ranges[i + 1];
      if (next && next.type === "comment" /* COMMENT */ && next.from === r.to && ((_a = next.metadata) == null ? void 0 : _a.id) && !next.metadata.replyTo) {
        map.set(next.metadata.id, r);
      }
    }
  }
  return map;
}
var criticGutterField = import_state15.StateField.define({
  create(state) {
    return buildGutterMarkers(
      state.field(criticRangesField),
      state.field(editorModeField),
      state.doc
    );
  },
  update(markers, tr) {
    const ranges = tr.state.field(criticRangesField);
    const mode = tr.state.field(editorModeField);
    return buildGutterMarkers(ranges, mode, tr.state.doc);
  }
});
function buildGutterMarkers(ranges, mode, doc) {
  var _a, _b;
  if (mode === "viewing" /* VIEWING */) {
    return import_state15.RangeSet.empty;
  }
  const anchorMap = buildHighlightAnchorMap2(ranges);
  const lineMarkers = /* @__PURE__ */ new Map();
  for (const r of ranges) {
    if (r.type === "comment" /* COMMENT */ && ((_a = r.metadata) == null ? void 0 : _a.id) && !r.metadata.replyTo) {
      const anchor = anchorMap.get(r.metadata.id);
      const pos = anchor ? anchor.from : r.from;
      const lineFrom = doc.lineAt(pos).from;
      const resolved = r.metadata.status === "resolved";
      lineMarkers.set(lineFrom, new CommentGutterMarker(r.metadata.id, resolved));
    }
  }
  for (const r of ranges) {
    if ((r.type === "addition" /* ADDITION */ || r.type === "deletion" /* DELETION */ || r.type === "substitution" /* SUBSTITUTION */) && ((_b = r.metadata) == null ? void 0 : _b.id)) {
      const lineFrom = doc.lineAt(r.from).from;
      if (!lineMarkers.has(lineFrom)) {
        lineMarkers.set(lineFrom, new SuggestionGutterMarker(r.metadata.id));
      }
    }
  }
  const sorted = [...lineMarkers.entries()].sort((a, b) => a[0] - b[0]);
  const builder = new import_state15.RangeSetBuilder();
  for (const [pos, marker] of sorted) {
    builder.add(pos, pos, marker);
  }
  return builder.finish();
}
function criticGutter() {
  return [
    criticGutterField,
    (0, import_view3.gutter)({
      class: "critic-gutter",
      markers: (v) => v.state.field(criticGutterField)
    })
  ];
}

// src/editor/reading-view.ts
function stripMetadata(raw) {
  const idx = raw.indexOf("@@");
  return idx >= 0 ? raw.substring(idx + 2) : raw;
}
function escapeAttr(s) {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function criticReadingViewProcessor(el, ctx) {
  const html = el.innerHTML;
  if (!html.includes("{++") && !html.includes("{--") && !html.includes("{~~") && !html.includes("{>>") && !html.includes("{==")) {
    return;
  }
  let result = html;
  result = result.replace(
    /\{~~([\s\S]*?)~&gt;([\s\S]*?)~~\}/g,
    (_match, rawOld, rawNew) => {
      const oldText = stripMetadata(rawOld);
      const newText = rawNew;
      return `<del class="critic-deletion">${oldText}</del><ins class="critic-addition">${newText}</ins>`;
    }
  );
  result = result.replace(
    /\{~~([\s\S]*?)~>([\s\S]*?)~~\}/g,
    (_match, rawOld, rawNew) => {
      const oldText = stripMetadata(rawOld);
      const newText = rawNew;
      return `<del class="critic-deletion">${oldText}</del><ins class="critic-addition">${newText}</ins>`;
    }
  );
  result = result.replace(
    /\{\+\+([\s\S]*?)\+\+\}/g,
    (_match, raw) => {
      const content = stripMetadata(raw);
      return `<ins class="critic-addition">${content}</ins>`;
    }
  );
  result = result.replace(
    /\{--([\s\S]*?)--\}/g,
    (_match, raw) => {
      const content = stripMetadata(raw);
      return `<del class="critic-deletion">${content}</del>`;
    }
  );
  result = result.replace(
    /\{&gt;&gt;([\s\S]*?)&lt;&lt;\}/g,
    (_match, raw) => {
      const content = stripMetadata(raw);
      return `<span class="critic-reading-comment" title="${escapeAttr(content)}">&#x1F4AC;</span>`;
    }
  );
  result = result.replace(
    /\{>>([\s\S]*?)<<\}/g,
    (_match, raw) => {
      const content = stripMetadata(raw);
      return `<span class="critic-reading-comment" title="${escapeAttr(content)}">&#x1F4AC;</span>`;
    }
  );
  result = result.replace(
    /\{==([\s\S]*?)==\}/g,
    (_match, raw) => {
      const content = stripMetadata(raw);
      return `<mark class="critic-highlight">${content}</mark>`;
    }
  );
  if (result !== html) {
    el.innerHTML = result;
  }
}

// src/commands/strip.ts
var import_state17 = require("@codemirror/state");
function getStripText(range, mode) {
  var _a, _b;
  switch (range.type) {
    case "addition" /* ADDITION */:
      return mode === "accept" ? range.content : "";
    case "deletion" /* DELETION */:
      return mode === "accept" ? "" : range.content;
    case "substitution" /* SUBSTITUTION */:
      return mode === "accept" ? (_a = range.newContent) != null ? _a : "" : (_b = range.oldContent) != null ? _b : "";
    case "comment" /* COMMENT */:
      return "";
    case "highlight" /* HIGHLIGHT */:
      return range.content;
  }
}
function stripAllMarkup(view, mode) {
  const ranges = view.state.field(criticRangesField);
  if (ranges.length === 0)
    return;
  const changes = [...ranges].reverse().map((range) => ({
    from: range.from,
    to: range.to,
    insert: getStripText(range, mode)
  }));
  view.dispatch({
    changes,
    annotations: import_state17.Transaction.userEvent.of(`critic.strip-${mode}`)
  });
}

// src/editor/clean-clipboard.ts
var import_view4 = require("@codemirror/view");
function stripCriticMarkupText(text) {
  text = text.replace(/\{~~(?:[\s\S]*?@@)?([\s\S]*?)~>([\s\S]*?)~~\}/g, "$2");
  text = text.replace(/\{\+\+(?:[\s\S]*?@@)?([\s\S]*?)\+\+\}/g, "$1");
  text = text.replace(/\{--(?:[\s\S]*?@@)?[\s\S]*?--\}/g, "");
  text = text.replace(/\{>>[\s\S]*?<<\}/g, "");
  text = text.replace(/\{==(?:[\s\S]*?@@)?([\s\S]*?)==\}/g, "$1");
  return text;
}
var CRITIC_DELIM = /\{(?:\+\+|--|~~|>>|==)/;
function cleanClipboardHandler() {
  return import_view4.EditorView.domEventHandlers({
    copy(event, view) {
      var _a;
      const sel = view.state.selection.main;
      if (sel.empty)
        return false;
      const text = view.state.sliceDoc(sel.from, sel.to);
      if (!CRITIC_DELIM.test(text))
        return false;
      const clean = stripCriticMarkupText(text);
      event.preventDefault();
      (_a = event.clipboardData) == null ? void 0 : _a.setData("text/plain", clean);
      return true;
    },
    cut(event, view) {
      var _a;
      const sel = view.state.selection.main;
      if (sel.empty)
        return false;
      const text = view.state.sliceDoc(sel.from, sel.to);
      if (!CRITIC_DELIM.test(text))
        return false;
      const clean = stripCriticMarkupText(text);
      event.preventDefault();
      (_a = event.clipboardData) == null ? void 0 : _a.setData("text/plain", clean);
      view.dispatch({
        changes: { from: sel.from, to: sel.to },
        selection: { anchor: sel.from }
      });
      return true;
    }
  });
}

// src/main.ts
var MODE_ICONS = {
  ["editing" /* EDITING */]: "pencil",
  ["suggesting" /* SUGGESTING */]: "pencil-line",
  ["viewing" /* VIEWING */]: "eye"
};
var MODE_LABELS = {
  ["editing" /* EDITING */]: "Editing",
  ["suggesting" /* SUGGESTING */]: "Suggesting",
  ["viewing" /* VIEWING */]: "Viewing"
};
var authorNameCompartment = new import_state19.Compartment();
function findCommentIdAtPosition(ranges, pos) {
  var _a, _b;
  for (let i = 0; i < ranges.length; i++) {
    const r = ranges[i];
    if (r.type === "highlight" /* HIGHLIGHT */ && pos >= r.from && pos <= r.to) {
      const next = ranges[i + 1];
      if (next && next.type === "comment" /* COMMENT */ && next.from === r.to && ((_a = next.metadata) == null ? void 0 : _a.id) && !next.metadata.replyTo) {
        return next.metadata.id;
      }
    }
    if ((r.type === "addition" /* ADDITION */ || r.type === "deletion" /* DELETION */ || r.type === "substitution" /* SUBSTITUTION */) && ((_b = r.metadata) == null ? void 0 : _b.id) && pos >= r.from && pos <= r.to) {
      return r.metadata.id;
    }
  }
  return null;
}
var CriticPlugin = class extends import_obsidian6.Plugin {
  constructor() {
    super(...arguments);
    this.settings = DEFAULT_SETTINGS;
    this.currentMode = "editing" /* EDITING */;
    this.statusBarEl = null;
    /** Track the last active editor view so sidebar callbacks work even when sidebar is focused. */
    this.lastEditorView = null;
  }
  async onload() {
    await this.loadSettings();
    this.registerView(COMMENTS_VIEW_TYPE, (leaf) => {
      const panel = new CommentsPanel(leaf);
      panel.setCallbacks(this.buildSidebarCallbacks());
      if (this.lastEditorView) {
        const ranges = this.lastEditorView.state.field(criticRangesField);
        setTimeout(() => panel.update(ranges), 0);
      }
      return panel;
    });
    this.registerEditorExtension([
      criticRangesField,
      focusedCommentField,
      criticDecorationsField,
      editorModeField,
      gutterCompartment.of(this.settings.showGutter ? criticGutter() : []),
      authorNameCompartment.of(authorNameFacet.of(this.settings.authorName)),
      suggestingModeCompartment.of([]),
      readOnlyCompartment.of(import_state19.EditorState.readOnly.of(false)),
      cleanClipboardHandler(),
      this.buildBridgePlugin()
    ]);
    this.statusBarEl = this.addStatusBarItem();
    this.statusBarEl.addClass("critic-mode-status");
    this.updateStatusBar();
    this.statusBarEl.addEventListener("click", (e) => {
      this.showModeMenu(e);
    });
    this.addRibbonIcon("message-square", "Toggle comments", () => {
      this.toggleSidebar();
    });
    this.addCommand({
      id: "set-editing-mode",
      name: "Set mode: Editing",
      hotkeys: [{ modifiers: ["Mod", "Shift"], key: "e" }],
      callback: () => this.setMode("editing" /* EDITING */)
    });
    this.addCommand({
      id: "set-suggesting-mode",
      name: "Set mode: Suggesting",
      hotkeys: [{ modifiers: ["Mod", "Shift"], key: "s" }],
      callback: () => this.setMode("suggesting" /* SUGGESTING */)
    });
    this.addCommand({
      id: "set-viewing-mode",
      name: "Set mode: Viewing",
      hotkeys: [{ modifiers: ["Mod", "Shift"], key: "d" }],
      callback: () => this.setMode("viewing" /* VIEWING */)
    });
    this.addCommand({
      id: "accept-suggestion",
      name: "Accept suggestion at cursor",
      editorCheckCallback: (checking, editor, view) => {
        var _a;
        const cmView = (_a = view == null ? void 0 : view.editor) == null ? void 0 : _a.cm;
        if (!cmView)
          return false;
        const range = findSuggestionAtCursor(cmView.state);
        if (checking)
          return range !== void 0;
        if (range)
          acceptSuggestion(cmView, range);
        return true;
      }
    });
    this.addCommand({
      id: "reject-suggestion",
      name: "Reject suggestion at cursor",
      editorCheckCallback: (checking, editor, view) => {
        var _a;
        const cmView = (_a = view == null ? void 0 : view.editor) == null ? void 0 : _a.cm;
        if (!cmView)
          return false;
        const range = findSuggestionAtCursor(cmView.state);
        if (checking)
          return range !== void 0;
        if (range)
          rejectSuggestion(cmView, range);
        return true;
      }
    });
    this.addCommand({
      id: "accept-all-suggestions",
      name: "Accept all suggestions",
      editorCallback: (editor, view) => {
        var _a;
        const cmView = (_a = view == null ? void 0 : view.editor) == null ? void 0 : _a.cm;
        if (cmView)
          acceptAllSuggestions(cmView);
      }
    });
    this.addCommand({
      id: "reject-all-suggestions",
      name: "Reject all suggestions",
      editorCallback: (editor, view) => {
        var _a;
        const cmView = (_a = view == null ? void 0 : view.editor) == null ? void 0 : _a.cm;
        if (cmView)
          rejectAllSuggestions(cmView);
      }
    });
    this.addCommand({
      id: "resolve-all-comments",
      name: "Resolve all comments",
      editorCallback: (editor, view) => {
        var _a;
        const cmView = (_a = view == null ? void 0 : view.editor) == null ? void 0 : _a.cm;
        if (cmView)
          resolveAllComments(cmView);
      }
    });
    this.addCommand({
      id: "strip-accept",
      name: "Strip markup (accept all changes)",
      editorCallback: (editor, view) => {
        var _a;
        const cmView = (_a = view == null ? void 0 : view.editor) == null ? void 0 : _a.cm;
        if (cmView)
          stripAllMarkup(cmView, "accept");
      }
    });
    this.addCommand({
      id: "strip-reject",
      name: "Strip markup (reject all changes)",
      editorCallback: (editor, view) => {
        var _a;
        const cmView = (_a = view == null ? void 0 : view.editor) == null ? void 0 : _a.cm;
        if (cmView)
          stripAllMarkup(cmView, "reject");
      }
    });
    this.registerMarkdownPostProcessor(criticReadingViewProcessor);
    this.addCommand({
      id: "submit-comment",
      name: "Submit comment",
      hotkeys: [{ modifiers: ["Mod", "Shift"], key: "Enter" }],
      checkCallback: (checking) => {
        const activeEl = document.activeElement;
        if (activeEl instanceof HTMLTextAreaElement && activeEl.closest(".critic-card-input")) {
          if (!checking) {
            activeEl.dispatchEvent(new Event("critic-submit"));
          }
          return true;
        }
        return false;
      }
    });
    this.addCommand({
      id: "add-comment",
      name: "Add comment",
      hotkeys: [{ modifiers: ["Mod", "Shift"], key: "m" }],
      editorCallback: (editor, view) => {
        var _a;
        if (!this.settings.authorName) {
          new import_obsidian6.Notice("Please set your author name in CriticMarkup settings first.");
          return;
        }
        if (this.currentMode === "viewing" /* VIEWING */) {
          new import_obsidian6.Notice("Cannot add comments in Viewing mode.");
          return;
        }
        const cmView = (_a = view == null ? void 0 : view.editor) == null ? void 0 : _a.cm;
        if (!cmView)
          return;
        const commentId = addComment(cmView, this.settings.authorName);
        this.openSidebarAndFocus(commentId);
      }
    });
    this.registerEvent(
      this.app.workspace.on("editor-menu", (menu, editor, view) => {
        var _a;
        if (this.currentMode === "viewing" /* VIEWING */)
          return;
        const cmView = (_a = view == null ? void 0 : view.editor) == null ? void 0 : _a.cm;
        if (!cmView)
          return;
        const sel = cmView.state.selection.main;
        if (sel.empty)
          return;
        menu.addItem((item) => {
          item.setTitle("Add comment").setIcon("message-square").onClick(() => {
            if (!this.settings.authorName) {
              new import_obsidian6.Notice("Please set your author name in CriticMarkup settings first.");
              return;
            }
            const commentId = addComment(cmView, this.settings.authorName);
            this.openSidebarAndFocus(commentId);
          });
        });
      })
    );
    this.addSettingTab(new CriticSettingTab(this.app, this));
    this.app.workspace.onLayoutReady(() => {
      setTimeout(() => {
        const mode = this.settings.defaultMode;
        if (mode === "suggesting" /* SUGGESTING */ && !this.settings.authorName) {
          this.setMode("editing" /* EDITING */);
        } else if (mode !== "editing" /* EDITING */) {
          this.setMode(mode);
        }
      }, 200);
    });
    this.registerEvent(
      this.app.workspace.on("active-leaf-change", (leaf) => {
        this.syncActiveEditor(leaf);
      })
    );
    this.registerEvent(
      this.app.workspace.on("layout-change", () => {
        const leaf = this.app.workspace.activeLeaf;
        this.syncActiveEditor(leaf != null ? leaf : null);
      })
    );
  }
  onunload() {
  }
  /**
   * Reconfigure the gutter compartment in all editors based on settings.
   */
  reconfigureGutter() {
    this.app.workspace.iterateAllLeaves((leaf) => {
      var _a, _b;
      const cmView = (_b = (_a = leaf.view) == null ? void 0 : _a.editor) == null ? void 0 : _b.cm;
      if (!cmView)
        return;
      cmView.dispatch({
        effects: gutterCompartment.reconfigure(
          this.settings.showGutter ? criticGutter() : []
        )
      });
    });
  }
  /**
   * Sync the sidebar and internal state when the active editor changes.
   * Called from both active-leaf-change and layout-change events.
   */
  syncActiveEditor(leaf) {
    var _a, _b;
    this.updateStatusBar();
    if ((leaf == null ? void 0 : leaf.view) instanceof CommentsPanel)
      return;
    const cmView = leaf ? (_b = (_a = leaf.view) == null ? void 0 : _a.editor) == null ? void 0 : _b.cm : void 0;
    if (cmView) {
      this.lastEditorView = cmView;
      const panel = this.getSidebarView();
      if (panel) {
        const ranges = cmView.state.field(criticRangesField);
        panel.update(ranges);
      }
    } else {
      this.lastEditorView = null;
      const panel = this.getSidebarView();
      if (panel)
        panel.update([]);
    }
  }
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }
  async saveSettings() {
    await this.saveData(this.settings);
    this.app.workspace.iterateAllLeaves((leaf) => {
      var _a, _b;
      const cmView = (_b = (_a = leaf.view) == null ? void 0 : _a.editor) == null ? void 0 : _b.cm;
      if (!cmView)
        return;
      cmView.dispatch({
        effects: authorNameCompartment.reconfigure(
          authorNameFacet.of(this.settings.authorName)
        )
      });
    });
  }
  /**
   * Set the editor mode across all open editors.
   */
  setMode(mode) {
    if (mode === "suggesting" /* SUGGESTING */ && !this.settings.authorName) {
      new import_obsidian6.Notice("Please set your author name in CriticMarkup settings before using Suggesting mode.");
      return;
    }
    this.currentMode = mode;
    this.updateStatusBar();
    this.app.workspace.iterateAllLeaves((leaf) => {
      var _a, _b;
      const cmView = (_b = (_a = leaf.view) == null ? void 0 : _a.editor) == null ? void 0 : _b.cm;
      if (!cmView)
        return;
      const effects = [
        setModeEffect.of(mode),
        suggestingModeCompartment.reconfigure(
          mode === "suggesting" /* SUGGESTING */ ? import_state19.Prec.high(suggestingModeFilter(this.settings.authorName)) : []
        ),
        readOnlyCompartment.reconfigure(
          import_state19.EditorState.readOnly.of(mode === "viewing" /* VIEWING */)
        )
      ];
      cmView.dispatch({ effects });
    });
  }
  /**
   * Update the status bar to reflect the current mode.
   */
  updateStatusBar() {
    if (!this.statusBarEl)
      return;
    this.statusBarEl.empty();
    const iconEl = this.statusBarEl.createSpan({ cls: "menu-icon" });
    (0, import_obsidian6.setIcon)(iconEl, MODE_ICONS[this.currentMode]);
    this.statusBarEl.createSpan({ text: MODE_LABELS[this.currentMode] });
  }
  /**
   * Show the mode selection menu above the status bar.
   */
  showModeMenu(e) {
    const menu = new import_obsidian6.Menu();
    for (const mode of ["editing" /* EDITING */, "suggesting" /* SUGGESTING */, "viewing" /* VIEWING */]) {
      menu.addItem((item) => {
        item.setTitle(MODE_LABELS[mode]).setIcon(MODE_ICONS[mode]).setChecked(this.currentMode === mode).onClick(() => this.setMode(mode));
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
  getSidebarView() {
    const leaves = this.app.workspace.getLeavesOfType(COMMENTS_VIEW_TYPE);
    if (leaves.length > 0) {
      return leaves[0].view;
    }
    return null;
  }
  /**
   * Toggle the comments sidebar.
   */
  async toggleSidebar() {
    var _a;
    const existing = this.getSidebarView();
    if (existing) {
      existing.leaf.detach();
    } else {
      await ((_a = this.app.workspace.getRightLeaf(false)) == null ? void 0 : _a.setViewState({
        type: COMMENTS_VIEW_TYPE,
        active: true
      }));
    }
  }
  /**
   * Open sidebar and focus a specific comment card (pending input for new comment).
   */
  async openSidebarAndFocus(commentId) {
    const panel = await this.ensureSidebarOpen();
    if (panel) {
      panel.setPendingComment(commentId);
      panel.focusCard(commentId);
    }
  }
  /**
   * Open sidebar if not open and focus a card (no pending input, for indicator clicks).
   */
  async openSidebarAndFocusExisting(commentId) {
    const panel = await this.ensureSidebarOpen();
    if (panel) {
      panel.focusCard(commentId);
    }
  }
  /**
   * Ensure sidebar is open and synced. Returns the panel.
   */
  async ensureSidebarOpen() {
    var _a;
    let panel = this.getSidebarView();
    if (!panel) {
      await ((_a = this.app.workspace.getRightLeaf(false)) == null ? void 0 : _a.setViewState({
        type: COMMENTS_VIEW_TYPE,
        active: true
      }));
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
  onRangesChanged(ranges) {
    const panel = this.getSidebarView();
    if (panel) {
      panel.update(ranges);
    }
  }
  /**
   * Get the last known editor view (works even when sidebar is focused).
   */
  getEditorView() {
    return this.lastEditorView;
  }
  /**
   * Build a CM6 ViewPlugin that bridges editor state changes to the plugin.
   */
  buildBridgePlugin() {
    const plugin = this;
    return import_view5.ViewPlugin.fromClass(
      class {
        constructor(view) {
          this.view = view;
          this.lastRanges = [];
          this.lastCursorCommentId = null;
          this.lastRanges = view.state.field(criticRangesField);
          plugin.lastEditorView = view;
          plugin.onRangesChanged(this.lastRanges);
        }
        update(update) {
          var _a, _b;
          plugin.lastEditorView = this.view;
          const newRanges = update.state.field(criticRangesField);
          if (newRanges !== this.lastRanges) {
            this.lastRanges = newRanges;
            plugin.onRangesChanged(newRanges);
          }
          for (const tr of update.transactions) {
            for (const e of tr.effects) {
              if (e.is(commentCreatedEffect)) {
                plugin.openSidebarAndFocus(e.value);
              }
            }
          }
          if (update.selectionSet) {
            const sel = update.state.selection.main;
            const ranges = update.state.field(criticRangesField);
            const commentId = findCommentIdAtPosition(ranges, sel.head);
            if (commentId !== this.lastCursorCommentId) {
              this.lastCursorCommentId = commentId;
              const view = this.view;
              requestAnimationFrame(() => {
                view.dispatch({
                  effects: setFocusedCommentEffect.of(commentId)
                });
              });
            }
          }
          const focusedId = (_a = update.state.field(focusedCommentField, false)) != null ? _a : null;
          const prevFocusedId = (_b = update.startState.field(focusedCommentField, false)) != null ? _b : null;
          if (focusedId !== prevFocusedId) {
            if (focusedId) {
              plugin.openSidebarAndFocusExisting(focusedId);
            } else {
              const panel = plugin.getSidebarView();
              if (panel)
                panel.setFocusedId(null);
            }
          }
        }
      }
    );
  }
  /**
   * Build callbacks that the sidebar uses to trigger actions on the editor.
   */
  buildSidebarCallbacks() {
    return {
      onResolve: (thread) => {
        const cmView = this.getEditorView();
        if (cmView)
          resolveComment(cmView, thread.root);
      },
      onReopen: (thread) => {
        const cmView = this.getEditorView();
        if (cmView)
          reopenComment(cmView, thread.root);
      },
      onAccept: (thread) => {
        const cmView = this.getEditorView();
        if (cmView)
          acceptSuggestion(cmView, thread.root);
      },
      onReject: (thread) => {
        const cmView = this.getEditorView();
        if (cmView)
          rejectSuggestion(cmView, thread.root);
      },
      onReply: (thread, text) => {
        const cmView = this.getEditorView();
        if (cmView)
          addReply(cmView, thread.id, text, this.settings.authorName);
      },
      onFocus: (thread) => {
        var _a, _b, _c;
        const cmView = this.getEditorView();
        if (!cmView)
          return;
        cmView.dispatch({
          effects: setFocusedCommentEffect.of(thread.id)
        });
        const pos = (_b = (_a = thread.anchor) == null ? void 0 : _a.from) != null ? _b : thread.root.from;
        const panel = this.getSidebarView();
        const cardEl = (_c = panel == null ? void 0 : panel.containerEl) == null ? void 0 : _c.querySelector(
          `[data-thread-id="${thread.id}"]`
        );
        if (cardEl) {
          const cardTop = cardEl.getBoundingClientRect().top;
          const editorRect = cmView.scrollDOM.getBoundingClientRect();
          const lineBlock = cmView.lineBlockAt(pos);
          cmView.scrollDOM.scrollTop = lineBlock.top - (cardTop - editorRect.top);
        } else {
          cmView.dispatch({
            effects: import_view5.EditorView.scrollIntoView(pos, { y: "start", yMargin: 50 })
          });
        }
      },
      onSaveEdit: (thread, text) => {
        const cmView = this.getEditorView();
        if (cmView) {
          saveCommentText(cmView, thread.id, text);
          const panel = this.getSidebarView();
          if (panel)
            panel.removePendingComment(thread.id);
        }
      },
      onCancelEmpty: (thread) => {
        const cmView = this.getEditorView();
        if (cmView) {
          cancelEmptyComment(cmView, thread.id);
          const panel = this.getSidebarView();
          if (panel)
            panel.removePendingComment(thread.id);
        }
      },
      onAcceptAll: () => {
        const cmView = this.getEditorView();
        if (cmView)
          acceptAllSuggestions(cmView);
      },
      onRejectAll: () => {
        const cmView = this.getEditorView();
        if (cmView)
          rejectAllSuggestions(cmView);
      },
      onResolveAll: () => {
        const cmView = this.getEditorView();
        if (cmView)
          resolveAllComments(cmView);
      }
    };
  }
};
