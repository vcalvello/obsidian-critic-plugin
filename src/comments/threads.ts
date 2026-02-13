import { CriticRange, CriticType, CommentThread, CommentStatus } from "../types";

/**
 * Build CommentThread[] from parsed CriticRange[].
 *
 * A thread is rooted by either:
 * - A comment ({>>...<<}) without replyTo
 * - A suggestion (addition/deletion/substitution) with metadata
 *
 * An anchor is a highlight ({==...==}) that immediately precedes a comment
 * (highlight.to === comment.from).
 *
 * Replies are comments with replyTo matching the root's id.
 */
export function buildThreads(ranges: CriticRange[]): CommentThread[] {
  // Index ranges with metadata by id
  const byId = new Map<string, CriticRange>();
  for (const r of ranges) {
    if (r.metadata?.id) {
      byId.set(r.metadata.id, r);
    }
  }

  // Collect highlights for anchor lookup (position-based)
  const highlights = ranges.filter((r) => r.type === CriticType.HIGHLIGHT);

  // Find root comments: comment ranges without replyTo
  const rootComments = ranges.filter(
    (r) => r.type === CriticType.COMMENT && r.metadata && !r.metadata.replyTo
  );

  // Find root suggestions: suggestion ranges with metadata (they can have threads too)
  const rootSuggestions = ranges.filter(
    (r) =>
      (r.type === CriticType.ADDITION ||
        r.type === CriticType.DELETION ||
        r.type === CriticType.SUBSTITUTION) &&
      r.metadata?.id
  );

  // Collect replies grouped by parent id
  const repliesByParent = new Map<string, CriticRange[]>();
  for (const r of ranges) {
    if (r.type === CriticType.COMMENT && r.metadata?.replyTo) {
      const parentId = r.metadata.replyTo;
      if (!repliesByParent.has(parentId)) {
        repliesByParent.set(parentId, []);
      }
      repliesByParent.get(parentId)!.push(r);
    }
  }

  // Sort replies by time
  for (const replies of repliesByParent.values()) {
    replies.sort((a, b) => (a.metadata?.time ?? 0) - (b.metadata?.time ?? 0));
  }

  const threads: CommentThread[] = [];

  // Build comment threads
  for (const root of rootComments) {
    const id = root.metadata!.id;
    // Find anchor: highlight that ends exactly where this comment starts
    const anchor = highlights.find((h) => h.to === root.from);
    const replies = repliesByParent.get(id) ?? [];
    const status: CommentStatus = (root.metadata?.status as CommentStatus) ?? "open";

    threads.push({ id, anchor, root, replies, type: "comment", status });
  }

  // Build suggestion threads (always show in sidebar, like Google Docs)
  for (const root of rootSuggestions) {
    const id = root.metadata!.id;
    const replies = repliesByParent.get(id) ?? [];
    const status: CommentStatus = (root.metadata?.status as CommentStatus) ?? "open";
    threads.push({ id, root, replies, type: "suggestion", status });
  }

  // Sort by position in document
  threads.sort((a, b) => {
    const posA = a.anchor?.from ?? a.root.from;
    const posB = b.anchor?.from ?? b.root.from;
    return posA - posB;
  });

  return threads;
}
