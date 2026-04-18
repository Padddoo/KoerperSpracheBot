export type Role = "user" | "assistant";

export interface Message {
  role: Role;
  content: string;
}

export interface SessionInfo {
  sessionId: string;
  filenames: string[];
  charCount: number;
  material: string;
}
