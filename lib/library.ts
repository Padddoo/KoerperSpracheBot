import type { LibraryEntry, SessionInfo } from "@/types";

export function sessionToEntry(session: SessionInfo): LibraryEntry {
  return {
    materialHash: session.materialHash,
    filenames: session.filenames,
    material: session.material,
    topics: session.topics,
    charCount: session.charCount,
    createdAt: Date.now(),
    lastUsedAt: Date.now(),
  };
}

export function entryToSession(entry: LibraryEntry): SessionInfo {
  return {
    sessionId: `ses_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`,
    filenames: entry.filenames,
    material: entry.material,
    topics: entry.topics,
    charCount: entry.charCount,
    materialHash: entry.materialHash,
  };
}

export function displayNameFor(entry: LibraryEntry): string {
  if (entry.displayName) return entry.displayName;
  if (entry.filenames.length === 1) {
    return entry.filenames[0].replace(/\.(pdf|docx?|txt|md)$/i, "");
  }
  return `${entry.filenames[0].replace(/\.(pdf|docx?|txt|md)$/i, "")} + ${entry.filenames.length - 1}`;
}

export function relativeTime(ts: number): string {
  const diffMs = Date.now() - ts;
  const mins = Math.round(diffMs / 60000);
  const hours = Math.round(diffMs / 3_600_000);
  const days = Math.round(diffMs / 86_400_000);
  if (mins < 2) return "gerade eben";
  if (mins < 60) return `vor ${mins} Min.`;
  if (hours < 24) return `vor ${hours} Std.`;
  if (days === 1) return "gestern";
  if (days < 7) return `vor ${days} Tagen`;
  const d = new Date(ts);
  return d.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}
