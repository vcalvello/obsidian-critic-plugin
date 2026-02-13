/**
 * MarkdownPostProcessor for Reading View.
 * Replaces CriticMarkup syntax with styled HTML elements.
 */

/** Strip metadata prefix (JSON@@) from raw CriticMarkup content. */
function stripMetadata(raw: string): string {
  const idx = raw.indexOf("@@");
  return idx >= 0 ? raw.substring(idx + 2) : raw;
}

/** Escape a string for use in an HTML attribute value. */
function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * MarkdownPostProcessor that converts CriticMarkup to styled HTML in Reading View.
 *
 * Handles:
 * - {++...++} → <ins class="critic-addition">
 * - {--...--} → <del class="critic-deletion">
 * - {~~...~>...~~} → <del>old</del><ins>new</ins>
 * - {>>...<<} → comment bubble with tooltip
 * - {==...==} → <mark class="critic-highlight">
 */
export function criticReadingViewProcessor(el: HTMLElement, ctx: any): void {
  const html = el.innerHTML;

  // Fast exit: skip if no CriticMarkup delimiters present
  if (
    !html.includes("{++") &&
    !html.includes("{--") &&
    !html.includes("{~~") &&
    !html.includes("{>>") &&
    !html.includes("{==")
  ) {
    return;
  }

  let result = html;

  // Substitutions: {~~old~>new~~} (must process before individual add/del)
  result = result.replace(
    /\{~~([\s\S]*?)~&gt;([\s\S]*?)~~\}/g,
    (_match, rawOld: string, rawNew: string) => {
      const oldText = stripMetadata(rawOld);
      const newText = rawNew;
      return `<del class="critic-deletion">${oldText}</del><ins class="critic-addition">${newText}</ins>`;
    }
  );

  // Also handle unescaped ~> (in case Obsidian doesn't escape it)
  result = result.replace(
    /\{~~([\s\S]*?)~>([\s\S]*?)~~\}/g,
    (_match, rawOld: string, rawNew: string) => {
      const oldText = stripMetadata(rawOld);
      const newText = rawNew;
      return `<del class="critic-deletion">${oldText}</del><ins class="critic-addition">${newText}</ins>`;
    }
  );

  // Additions: {++...++}
  result = result.replace(
    /\{\+\+([\s\S]*?)\+\+\}/g,
    (_match, raw: string) => {
      const content = stripMetadata(raw);
      return `<ins class="critic-addition">${content}</ins>`;
    }
  );

  // Deletions: {--...--}
  result = result.replace(
    /\{--([\s\S]*?)--\}/g,
    (_match, raw: string) => {
      const content = stripMetadata(raw);
      return `<del class="critic-deletion">${content}</del>`;
    }
  );

  // Comments: {>>...<<}
  result = result.replace(
    /\{&gt;&gt;([\s\S]*?)&lt;&lt;\}/g,
    (_match, raw: string) => {
      const content = stripMetadata(raw);
      return `<span class="critic-reading-comment" title="${escapeAttr(content)}">&#x1F4AC;</span>`;
    }
  );

  // Also handle unescaped >> << (in case Obsidian doesn't escape them)
  result = result.replace(
    /\{>>([\s\S]*?)<<\}/g,
    (_match, raw: string) => {
      const content = stripMetadata(raw);
      return `<span class="critic-reading-comment" title="${escapeAttr(content)}">&#x1F4AC;</span>`;
    }
  );

  // Highlights: {==...==}
  // Obsidian may render ==text== as <mark>text</mark> inside {==...==}
  // Handle the case where inner content has been processed by Obsidian
  result = result.replace(
    /\{==([\s\S]*?)==\}/g,
    (_match, raw: string) => {
      const content = stripMetadata(raw);
      return `<mark class="critic-highlight">${content}</mark>`;
    }
  );

  if (result !== html) {
    el.innerHTML = result;
  }
}
