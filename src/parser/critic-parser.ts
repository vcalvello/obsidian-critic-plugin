import { nanoid } from "nanoid";
import { CriticType, CriticRange, CriticMetadata } from "../types";

// Regex patterns for each CriticMarkup type (lazy matching, supports multiline)
const PATTERNS: { type: CriticType; regex: RegExp }[] = [
  { type: CriticType.ADDITION, regex: /\{\+\+([\s\S]*?)\+\+\}/g },
  { type: CriticType.DELETION, regex: /\{--([\s\S]*?)--\}/g },
  { type: CriticType.SUBSTITUTION, regex: /\{~~([\s\S]*?)~>([\s\S]*?)~~\}/g },
  { type: CriticType.COMMENT, regex: /\{>>([\s\S]*?)<<\}/g },
  { type: CriticType.HIGHLIGHT, regex: /\{==([\s\S]*?)==\}/g },
];

const METADATA_SEPARATOR = "@@";

/**
 * Parse metadata JSON from the beginning of raw content.
 * Format: `{"author":"Victor","time":123}@@actual content`
 * If no `@@` separator, returns undefined (backwards compatible).
 */
export function parseMetadata(raw: string): { metadata: CriticMetadata | undefined; content: string } {
  const separatorIndex = raw.indexOf(METADATA_SEPARATOR);
  if (separatorIndex === -1) {
    return { metadata: undefined, content: raw };
  }

  const jsonStr = raw.substring(0, separatorIndex);
  try {
    const parsed = JSON.parse(jsonStr);
    return {
      metadata: parsed as CriticMetadata,
      content: raw.substring(separatorIndex + METADATA_SEPARATOR.length),
    };
  } catch {
    // If JSON parsing fails, treat the whole thing as content
    return { metadata: undefined, content: raw };
  }
}

/**
 * Serialize metadata to the `JSON@@` prefix format.
 */
export function serializeMetadata(meta: CriticMetadata): string {
  return JSON.stringify(meta) + METADATA_SEPARATOR;
}

/**
 * Generate a unique 8-character ID.
 */
export function generateId(): string {
  return nanoid(8);
}

/**
 * Parse all CriticMarkup in a text string and return sorted ranges.
 */
export function parseCriticMarkup(text: string): CriticRange[] {
  const ranges: CriticRange[] = [];

  for (const { type, regex } of PATTERNS) {
    // Reset lastIndex for each pattern
    regex.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      const from = match.index;
      const to = from + match[0].length;

      if (type === CriticType.SUBSTITUTION) {
        const rawOld = match[1];
        const rawNew = match[2];
        // Metadata is on the old side
        const { metadata, content: oldContent } = parseMetadata(rawOld);

        ranges.push({
          type,
          from,
          to,
          metadata,
          content: match[0],
          rawContent: rawOld,
          oldContent,
          newContent: rawNew,
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
          rawContent,
        });
      }
    }
  }

  // Sort by position in document
  ranges.sort((a, b) => a.from - b.from);
  return ranges;
}

/**
 * Create a CriticMarkup addition string with metadata.
 */
export function createAddition(text: string, author: string): string {
  const meta = serializeMetadata({
    id: generateId(),
    author,
    time: Math.floor(Date.now() / 1000),
  });
  return `{++${meta}${text}++}`;
}

/**
 * Create a CriticMarkup deletion string with metadata.
 */
export function createDeletion(text: string, author: string): string {
  const meta = serializeMetadata({
    id: generateId(),
    author,
    time: Math.floor(Date.now() / 1000),
  });
  return `{--${meta}${text}--}`;
}

/**
 * Create a CriticMarkup substitution string with metadata.
 */
export function createSubstitution(oldText: string, newText: string, author: string): string {
  const meta = serializeMetadata({
    id: generateId(),
    author,
    time: Math.floor(Date.now() / 1000),
  });
  return `{~~${meta}${oldText}~>${newText}~~}`;
}
