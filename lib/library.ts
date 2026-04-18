import type { LibraryEntry, SessionInfo } from "@/types";

const LIBRARY_KEY = "fred-lernt.library.v1";

export function loadLibrary(): LibraryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LIBRARY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LibraryEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLibrary(entries: LibraryEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LIBRARY_KEY, JSON.stringify(entries));
  } catch (err) {
    console.warn("library save failed", err);
  }
}

/** Upsert by materialHash. Updates lastUsedAt; preserves createdAt + displayName. */
export function upsertEntry(entry: LibraryEntry): LibraryEntry[] {
  const library = loadLibrary();
  const idx = library.findIndex((e) => e.materialHash === entry.materialHash);
  if (idx >= 0) {
    const existing = library[idx];
    library[idx] = {
      ...entry,
      createdAt: existing.createdAt,
      displayName: existing.displayName,
      lastUsedAt: Date.now(),
    };
  } else {
    library.push(entry);
  }
  saveLibrary(library);
  return library;
}

export function touchEntry(materialHash: string): LibraryEntry[] {
  const library = loadLibrary();
  const idx = library.findIndex((e) => e.materialHash === materialHash);
  if (idx >= 0) {
    library[idx] = { ...library[idx], lastUsedAt: Date.now() };
    saveLibrary(library);
  }
  return library;
}

export function removeEntry(materialHash: string): LibraryEntry[] {
  const library = loadLibrary().filter((e) => e.materialHash !== materialHash);
  saveLibrary(library);
  return library;
}

export function renameEntry(
  materialHash: string,
  displayName: string,
): LibraryEntry[] {
  const library = loadLibrary();
  const idx = library.findIndex((e) => e.materialHash === materialHash);
  if (idx >= 0) {
    library[idx] = {
      ...library[idx],
      displayName: displayName.trim() || undefined,
    };
    saveLibrary(library);
  }
  return library;
}

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
