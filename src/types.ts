export enum EditorMode {
  EDITING = "editing",
  SUGGESTING = "suggesting",
  VIEWING = "viewing",
}

export enum CriticType {
  ADDITION = "addition",
  DELETION = "deletion",
  SUBSTITUTION = "substitution",
  COMMENT = "comment",
  HIGHLIGHT = "highlight",
}

export interface CriticMetadata {
  id: string;
  author: string;
  time: number;
  status?: string;
  replyTo?: string;
}

export interface CriticRange {
  type: CriticType;
  from: number;
  to: number;
  metadata?: CriticMetadata;
  content: string;
  /** Raw content including metadata prefix, used for offset calculations */
  rawContent: string;
  /** For substitutions: the old text before ~> */
  oldContent?: string;
  /** For substitutions: the new text after ~> */
  newContent?: string;
}

export type CommentStatus = "open" | "resolved";

export interface CommentThread {
  id: string;
  anchor?: CriticRange;
  root: CriticRange;
  replies: CriticRange[];
  type: "comment" | "suggestion";
  status: CommentStatus;
}

export interface CriticPluginSettings {
  authorName: string;
}

export const DEFAULT_SETTINGS: CriticPluginSettings = {
  authorName: "",
};
