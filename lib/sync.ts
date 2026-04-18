import type { LibraryEntry, ProgressForMaterial } from "@/types";

type ProgressMap = Record<string, ProgressForMaterial>;

interface LibraryResponse {
  library: LibraryEntry[];
}

interface ProgressResponse {
  progress: ProgressMap;
}

interface FullResponse extends LibraryResponse, ProgressResponse {}

const FAMILY_CODE_KEY = "fred-lernt.familycode.v1";

export function loadFamilyCode(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(FAMILY_CODE_KEY);
    return raw && raw.length > 0 ? raw : null;
  } catch {
    return null;
  }
}

export function saveFamilyCode(code: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(FAMILY_CODE_KEY, code);
  } catch {
    // ignore
  }
}

export function clearFamilyCode(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(FAMILY_CODE_KEY);
  } catch {
    // ignore
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || `Fehler ${res.status}`);
  }
  return (await res.json()) as T;
}

export async function fetchAll(code: string): Promise<FullResponse> {
  const res = await fetch(`/api/library?code=${encodeURIComponent(code)}`, {
    cache: "no-store",
  });
  return handleResponse<FullResponse>(res);
}

export async function upsertEntryRemote(
  code: string,
  entry: LibraryEntry,
): Promise<LibraryEntry[]> {
  const res = await fetch(`/api/library?code=${encodeURIComponent(code)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ entry }),
  });
  const data = await handleResponse<LibraryResponse>(res);
  return data.library;
}

export async function deleteEntryRemote(
  code: string,
  materialHash: string,
): Promise<{ library: LibraryEntry[]; progress: ProgressMap }> {
  const res = await fetch(
    `/api/library/${encodeURIComponent(materialHash)}?code=${encodeURIComponent(code)}`,
    { method: "DELETE" },
  );
  return handleResponse<{ library: LibraryEntry[]; progress: ProgressMap }>(
    res,
  );
}

export async function renameEntryRemote(
  code: string,
  materialHash: string,
  displayName: string,
): Promise<LibraryEntry[]> {
  const res = await fetch(
    `/api/library/${encodeURIComponent(materialHash)}?code=${encodeURIComponent(code)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName }),
    },
  );
  const data = await handleResponse<LibraryResponse>(res);
  return data.library;
}

export async function saveProgressRemote(
  code: string,
  materialHash: string,
  progress: ProgressForMaterial,
): Promise<ProgressMap> {
  const res = await fetch(`/api/progress?code=${encodeURIComponent(code)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ materialHash, progress }),
  });
  const data = await handleResponse<ProgressResponse>(res);
  return data.progress;
}

export async function clearProgressRemote(
  code: string,
  materialHash: string,
): Promise<ProgressMap> {
  const res = await fetch(
    `/api/progress?code=${encodeURIComponent(code)}&hash=${encodeURIComponent(materialHash)}`,
    { method: "DELETE" },
  );
  const data = await handleResponse<ProgressResponse>(res);
  return data.progress;
}
