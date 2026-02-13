import { CommentThread } from "../types";

export type ThreadFilter = "all" | "open" | "resolved";

/**
 * Filter threads by status and optional search query.
 */
export function filterThreads(
  threads: CommentThread[],
  filter: ThreadFilter,
  searchQuery: string
): CommentThread[] {
  let result = threads;

  // Filter by status
  if (filter === "open") {
    result = result.filter((t) => t.status === "open");
  } else if (filter === "resolved") {
    result = result.filter((t) => t.status === "resolved");
  }

  // Filter by search query (case-insensitive)
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    result = result.filter((t) => {
      // Search in root comment content
      if (t.root.content.toLowerCase().includes(q)) return true;
      // Search in root author
      if (t.root.metadata?.author?.toLowerCase().includes(q)) return true;
      // Search in anchor text
      if (t.anchor?.content.toLowerCase().includes(q)) return true;
      // Search in suggestion text
      if (t.root.oldContent?.toLowerCase().includes(q)) return true;
      if (t.root.newContent?.toLowerCase().includes(q)) return true;
      // Search in replies
      for (const reply of t.replies) {
        if (reply.content.toLowerCase().includes(q)) return true;
        if (reply.metadata?.author?.toLowerCase().includes(q)) return true;
      }
      return false;
    });
  }

  return result;
}
