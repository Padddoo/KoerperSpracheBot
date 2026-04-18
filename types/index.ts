export type Role = "user" | "assistant";
export type Verdict = "correct" | "partial" | "incorrect" | "none";

export interface Message {
  role: Role;
  content: string;
  meta?: {
    topic: string;
    verdict: Verdict;
  };
}

export interface SessionInfo {
  sessionId: string;
  filenames: string[];
  charCount: number;
  material: string;
  topics: string[];
  materialHash: string;
}

export interface TopicStats {
  correct: number;
  partial: number;
  incorrect: number;
  lastAskedAt: number;
}

export type ProgressForMaterial = Record<string, TopicStats>;

export interface LibraryEntry {
  materialHash: string;
  filenames: string[];
  material: string;
  topics: string[];
  charCount: number;
  createdAt: number;
  lastUsedAt: number;
  displayName?: string;
}
