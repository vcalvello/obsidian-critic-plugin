import { setIcon } from "obsidian";
import { RangeSet, RangeSetBuilder, StateField } from "@codemirror/state";
import { EditorView, GutterMarker, gutter } from "@codemirror/view";
import { CriticRange, CriticType, EditorMode } from "../types";
import { criticRangesField } from "./state";
import { editorModeField } from "../modes/mode-state";
import { setFocusedCommentEffect } from "./focused-comment";

/**
 * Gutter marker for a comment thread.
 * Renders a message-circle icon; click dispatches focus effect.
 */
class CommentGutterMarker extends GutterMarker {
  constructor(
    readonly commentId: string,
    readonly resolved: boolean
  ) {
    super();
  }

  toDOM(view: EditorView): HTMLElement {
    const el = document.createElement("div");
    el.className = "critic-gutter-comment";
    if (this.resolved) el.classList.add("is-resolved");
    setIcon(el, "message-circle");
    el.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      view.dispatch({ effects: setFocusedCommentEffect.of(this.commentId) });
    });
    return el;
  }

  eq(other: GutterMarker): boolean {
    return (
      other instanceof CommentGutterMarker &&
      this.commentId === other.commentId &&
      this.resolved === other.resolved
    );
  }
}

/**
 * Gutter marker for a suggestion.
 * Renders a green vertical bar; click dispatches focus effect.
 */
class SuggestionGutterMarker extends GutterMarker {
  constructor(readonly suggestionId: string) {
    super();
  }

  toDOM(view: EditorView): HTMLElement {
    const el = document.createElement("div");
    el.className = "critic-gutter-suggestion";
    el.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      view.dispatch({ effects: setFocusedCommentEffect.of(this.suggestionId) });
    });
    return el;
  }

  eq(other: GutterMarker): boolean {
    return (
      other instanceof SuggestionGutterMarker &&
      this.suggestionId === other.suggestionId
    );
  }
}

/**
 * Build a map from comment ID to the adjacent highlight range (anchor).
 * A highlight anchors a comment when highlight.to === comment.from.
 */
function buildHighlightAnchorMap(ranges: CriticRange[]): Map<string, CriticRange> {
  const map = new Map<string, CriticRange>();
  for (let i = 0; i < ranges.length; i++) {
    const r = ranges[i];
    if (r.type === CriticType.HIGHLIGHT) {
      const next = ranges[i + 1];
      if (
        next &&
        next.type === CriticType.COMMENT &&
        next.from === r.to &&
        next.metadata?.id &&
        !next.metadata.replyTo
      ) {
        map.set(next.metadata.id, r);
      }
    }
  }
  return map;
}

/**
 * StateField that computes gutter markers from critic ranges.
 * Returns empty in Viewing mode.
 * Deduplicates by line: comments take priority over suggestions.
 */
export const criticGutterField = StateField.define<RangeSet<GutterMarker>>({
  create(state) {
    return buildGutterMarkers(
      state.field(criticRangesField),
      state.field(editorModeField),
      state.doc
    );
  },
  update(markers, tr) {
    // Recompute when ranges, mode, or doc change
    const ranges = tr.state.field(criticRangesField);
    const mode = tr.state.field(editorModeField);
    return buildGutterMarkers(ranges, mode, tr.state.doc);
  },
});

function buildGutterMarkers(
  ranges: CriticRange[],
  mode: EditorMode,
  doc: { lineAt(pos: number): { from: number } }
): RangeSet<GutterMarker> {
  if (mode === EditorMode.VIEWING) {
    return RangeSet.empty;
  }

  const anchorMap = buildHighlightAnchorMap(ranges);

  // Collect markers keyed by line start position, with priority
  // "comment" has priority over "suggestion"
  const lineMarkers = new Map<number, GutterMarker>();

  // Root comments (with metadata, no replyTo)
  for (const r of ranges) {
    if (
      r.type === CriticType.COMMENT &&
      r.metadata?.id &&
      !r.metadata.replyTo
    ) {
      const anchor = anchorMap.get(r.metadata.id);
      const pos = anchor ? anchor.from : r.from;
      const lineFrom = doc.lineAt(pos).from;
      const resolved = r.metadata.status === "resolved";
      // Comments always take priority
      lineMarkers.set(lineFrom, new CommentGutterMarker(r.metadata.id, resolved));
    }
  }

  // Suggestions with metadata
  for (const r of ranges) {
    if (
      (r.type === CriticType.ADDITION ||
        r.type === CriticType.DELETION ||
        r.type === CriticType.SUBSTITUTION) &&
      r.metadata?.id
    ) {
      const lineFrom = doc.lineAt(r.from).from;
      // Only add if no comment already on this line
      if (!lineMarkers.has(lineFrom)) {
        lineMarkers.set(lineFrom, new SuggestionGutterMarker(r.metadata.id));
      }
    }
  }

  // Build sorted RangeSet
  const sorted = [...lineMarkers.entries()].sort((a, b) => a[0] - b[0]);
  const builder = new RangeSetBuilder<GutterMarker>();
  for (const [pos, marker] of sorted) {
    builder.add(pos, pos, marker);
  }
  return builder.finish();
}

/**
 * Create the gutter extension array: StateField + gutter config.
 */
export function criticGutter() {
  return [
    criticGutterField,
    gutter({
      class: "critic-gutter",
      markers: (v) => v.state.field(criticGutterField),
    }),
  ];
}
