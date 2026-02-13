import { StateField } from "@codemirror/state";
import { Decoration, DecorationSet, EditorView, WidgetType } from "@codemirror/view";
import { CriticRange, CriticType, EditorMode } from "../types";
import { criticRangesField } from "./state";
import { editorModeField } from "../modes/mode-state";
import { focusedCommentField } from "./focused-comment";
import { CommentIndicatorWidget } from "./comment-indicator";

// Decoration marks for Editing/Suggesting
const additionMark = Decoration.mark({ class: "critic-addition" });
const deletionMark = Decoration.mark({ class: "critic-deletion" });
const highlightMark = Decoration.mark({ class: "critic-highlight" });
const highlightFocusedMark = Decoration.mark({ class: "critic-highlight-focused" });
const highlightResolvedMark = Decoration.mark({ class: "critic-highlight-resolved" });

/**
 * Widget that renders plain text, used in Viewing mode to completely replace
 * CriticMarkup ranges so Obsidian's own markdown decorations (~~, ==) can't
 * interfere.
 */
class PlainTextWidget extends WidgetType {
  constructor(readonly text: string) {
    super();
  }
  toDOM() {
    const span = document.createElement("span");
    span.textContent = this.text;
    return span;
  }
  eq(other: PlainTextWidget) {
    return this.text === other.text;
  }
}

/**
 * Calculate byte offsets for internal parts of a CriticRange.
 */
function getContentOffsets(range: CriticRange) {
  const metaSepIdx = range.rawContent.indexOf("@@");
  const metaPrefixLen = metaSepIdx >= 0 ? metaSepIdx + 2 : 0;

  if (range.type === CriticType.SUBSTITUTION) {
    const oldStart = range.from + 3 + metaPrefixLen;
    const oldEnd = oldStart + (range.oldContent?.length ?? 0);
    const arrowEnd = oldEnd + 2; // ~>
    const newStart = arrowEnd;
    const newEnd = newStart + (range.newContent?.length ?? 0);
    return { oldStart, oldEnd, arrowEnd, newStart, newEnd };
  }

  const contentStart = range.from + 3 + metaPrefixLen;
  const contentEnd = contentStart + range.content.length;
  return { contentStart, contentEnd };
}

/** Helper: push a replace decoration if from < to */
function hideRange(out: { from: number; to: number; decoration: Decoration }[], from: number, to: number) {
  if (from < to) {
    out.push({ from, to, decoration: Decoration.replace({}) });
  }
}

/**
 * Build a map from comment ID to the adjacent highlight range.
 * A highlight anchors a comment when highlight.to === comment.from.
 */
function buildHighlightAnchorMap(ranges: CriticRange[]): Map<string, CriticRange> {
  const map = new Map<string, CriticRange>();
  for (let i = 0; i < ranges.length; i++) {
    const r = ranges[i];
    if (r.type === CriticType.HIGHLIGHT) {
      // Look for the next range: if it's a comment starting right after, this is its anchor
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
 * Get the comment status for a given comment ID from ranges.
 */
function getCommentStatus(ranges: CriticRange[], commentId: string): string | undefined {
  for (const r of ranges) {
    if (r.metadata?.id === commentId) {
      return r.metadata.status;
    }
  }
  return undefined;
}

/**
 * Viewing mode: replace entire CriticMarkup ranges with plain text widgets.
 * This prevents Obsidian's native ~~strikethrough~~ and ==highlight== parsing
 * from interfering with our rendering.
 */
function buildViewingDecorations(ranges: CriticRange[]): DecorationSet {
  const decs: { from: number; to: number; decoration: Decoration }[] = [];

  for (const range of ranges) {
    switch (range.type) {
      case CriticType.ADDITION:
        // Hide entirely (text was added, original didn't have it)
        decs.push({
          from: range.from,
          to: range.to,
          decoration: Decoration.replace({}),
        });
        break;

      case CriticType.DELETION:
        // Replace entire range with plain text of the content (original text)
        decs.push({
          from: range.from,
          to: range.to,
          decoration: Decoration.replace({
            widget: new PlainTextWidget(range.content),
          }),
        });
        break;

      case CriticType.SUBSTITUTION:
        // Replace entire range with plain text of old content (original text)
        decs.push({
          from: range.from,
          to: range.to,
          decoration: Decoration.replace({
            widget: new PlainTextWidget(range.oldContent ?? ""),
          }),
        });
        break;

      case CriticType.HIGHLIGHT:
        // Replace entire range with plain text (strip highlight markers)
        decs.push({
          from: range.from,
          to: range.to,
          decoration: Decoration.replace({
            widget: new PlainTextWidget(range.content),
          }),
        });
        break;

      case CriticType.COMMENT:
        // Hide entirely
        decs.push({
          from: range.from,
          to: range.to,
          decoration: Decoration.replace({}),
        });
        break;
    }
  }

  // Merge overlapping ranges (from nested CriticMarkup)
  decs.sort((a, b) => a.from - b.from || a.to - b.to);
  const merged: typeof decs = [];
  for (const d of decs) {
    const last = merged[merged.length - 1];
    if (last && d.from < last.to) {
      // Overlapping: keep the larger range
      if (d.to > last.to) {
        last.to = d.to;
        last.decoration = d.decoration;
      }
    } else {
      merged.push({ from: d.from, to: d.to, decoration: d.decoration });
    }
  }

  return Decoration.set(
    merged.map((d) => d.decoration.range(d.from, d.to)),
    true
  );
}

/**
 * Editing/Suggesting mode: show inline decorations with styling.
 * Now also handles comment indicators and focused highlight state.
 */
function buildEditingDecorations(ranges: CriticRange[], focusedId: string | null): DecorationSet {
  const decs: { from: number; to: number; decoration: Decoration }[] = [];
  const anchorMap = buildHighlightAnchorMap(ranges);

  // Build a set of highlight ranges that are anchors for comments
  const anchoredHighlights = new Set<CriticRange>();
  for (const h of anchorMap.values()) {
    anchoredHighlights.add(h);
  }

  // Build reverse map: highlight -> commentId
  const highlightToCommentId = new Map<CriticRange, string>();
  for (const [commentId, highlight] of anchorMap.entries()) {
    highlightToCommentId.set(highlight, commentId);
  }

  for (const range of ranges) {
    switch (range.type) {
      case CriticType.ADDITION: {
        const o = getContentOffsets(range);
        if ("contentStart" in o) {
          hideRange(decs, range.from, o.contentStart);
          if (o.contentStart < o.contentEnd) {
            decs.push({ from: o.contentStart, to: o.contentEnd, decoration: additionMark });
          }
          hideRange(decs, o.contentEnd, range.to);
        }
        break;
      }

      case CriticType.DELETION: {
        const o = getContentOffsets(range);
        if ("contentStart" in o) {
          hideRange(decs, range.from, o.contentStart);
          if (o.contentStart < o.contentEnd) {
            decs.push({ from: o.contentStart, to: o.contentEnd, decoration: deletionMark });
          }
          hideRange(decs, o.contentEnd, range.to);
        }
        break;
      }

      case CriticType.SUBSTITUTION: {
        const o = getContentOffsets(range);
        if ("oldStart" in o) {
          hideRange(decs, range.from, o.oldStart);
          if (o.oldStart < o.oldEnd) {
            decs.push({ from: o.oldStart, to: o.oldEnd, decoration: deletionMark });
          }
          hideRange(decs, o.oldEnd, o.arrowEnd);
          if (o.newStart < o.newEnd) {
            decs.push({ from: o.newStart, to: o.newEnd, decoration: additionMark });
          }
          hideRange(decs, o.newEnd, range.to);
        }
        break;
      }

      case CriticType.HIGHLIGHT: {
        const o = getContentOffsets(range);
        if ("contentStart" in o) {
          const commentId = highlightToCommentId.get(range);

          if (commentId) {
            // This highlight is an anchor for a comment
            const resolved = getCommentStatus(ranges, commentId) === "resolved";
            let mark: Decoration;
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
            // Regular highlight (no associated comment)
            hideRange(decs, range.from, o.contentStart);
            if (o.contentStart < o.contentEnd) {
              decs.push({ from: o.contentStart, to: o.contentEnd, decoration: highlightMark });
            }
            hideRange(decs, o.contentEnd, range.to);
          }
        }
        break;
      }

      case CriticType.COMMENT: {
        // For root comments without a highlight anchor, show an indicator widget
        if (range.metadata?.id && !range.metadata.replyTo && !anchorMap.has(range.metadata.id)) {
          const resolved = range.metadata.status === "resolved";
          const widget = new CommentIndicatorWidget(range.metadata.id, resolved);
          decs.push({
            from: range.from,
            to: range.from,
            decoration: Decoration.widget({ widget, side: 1 }),
          });
        }
        // Hide the entire comment markup
        hideRange(decs, range.from, range.to);
        break;
      }
    }
  }

  return Decoration.set(
    decs.map((d) => d.decoration.range(d.from, d.to)),
    true
  );
}

/**
 * StateField that provides decorations for CriticMarkup rendering.
 */
export const criticDecorationsField = StateField.define<DecorationSet>({
  create(state) {
    const ranges = state.field(criticRangesField);
    const mode = state.field(editorModeField);
    try {
      if (mode === EditorMode.VIEWING) {
        return buildViewingDecorations(ranges);
      }
      const focusedId = state.field(focusedCommentField, false) ?? null;
      return buildEditingDecorations(ranges, focusedId);
    } catch (e) {
      console.error("[CriticMarkup] decoration error:", e);
      return Decoration.none;
    }
  },
  update(decorations, tr) {
    const ranges = tr.state.field(criticRangesField);
    const mode = tr.state.field(editorModeField);
    try {
      if (mode === EditorMode.VIEWING) {
        return buildViewingDecorations(ranges);
      }
      const focusedId = tr.state.field(focusedCommentField, false) ?? null;
      return buildEditingDecorations(ranges, focusedId);
    } catch (e) {
      console.error("[CriticMarkup] decoration error:", e);
      return Decoration.none;
    }
  },
  provide(field) {
    return EditorView.decorations.from(field);
  },
});
