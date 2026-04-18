import { NextRequest, NextResponse } from "next/server";
import { libraryKey, normalizeCode, progressKey, redis } from "@/lib/kv";
import type { LibraryEntry, ProgressForMaterial } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 30;

type ProgressMap = Record<string, ProgressForMaterial>;

async function loadLibrary(code: string): Promise<LibraryEntry[]> {
  const raw = await redis().get<LibraryEntry[] | string>(libraryKey(code));
  if (!raw) return [];
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as LibraryEntry[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return Array.isArray(raw) ? raw : [];
}

async function loadProgress(code: string): Promise<ProgressMap> {
  const raw = await redis().get<ProgressMap | string>(progressKey(code));
  if (!raw) return {};
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as ProgressMap;
    } catch {
      return {};
    }
  }
  return raw && typeof raw === "object" ? raw : {};
}

async function saveLibrary(
  code: string,
  library: LibraryEntry[],
): Promise<void> {
  await redis().set(libraryKey(code), JSON.stringify(library));
}

function getCode(req: NextRequest): string | null {
  return normalizeCode(req.nextUrl.searchParams.get("code") ?? "");
}

export async function GET(req: NextRequest) {
  try {
    const code = getCode(req);
    if (!code) {
      return NextResponse.json(
        { error: "Ungültiger Familien-Code." },
        { status: 400 },
      );
    }
    const [library, progress] = await Promise.all([
      loadLibrary(code),
      loadProgress(code),
    ]);
    return NextResponse.json({ library, progress });
  } catch (err) {
    console.error("[library GET] error:", err);
    return NextResponse.json(
      { error: "Bibliothek konnte nicht geladen werden." },
      { status: 500 },
    );
  }
}

/** Upsert an entry by materialHash. Body: { entry: LibraryEntry } */
export async function POST(req: NextRequest) {
  try {
    const code = getCode(req);
    if (!code) {
      return NextResponse.json(
        { error: "Ungültiger Familien-Code." },
        { status: 400 },
      );
    }
    const body = (await req.json()) as { entry?: LibraryEntry };
    if (!body.entry?.materialHash) {
      return NextResponse.json(
        { error: "Eintrag unvollständig." },
        { status: 400 },
      );
    }
    const library = await loadLibrary(code);
    const idx = library.findIndex(
      (e) => e.materialHash === body.entry!.materialHash,
    );
    if (idx >= 0) {
      library[idx] = {
        ...body.entry,
        createdAt: library[idx].createdAt,
        displayName: library[idx].displayName ?? body.entry.displayName,
        lastUsedAt: Date.now(),
      };
    } else {
      library.push(body.entry);
    }
    await saveLibrary(code, library);
    return NextResponse.json({ library });
  } catch (err) {
    console.error("[library POST] error:", err);
    return NextResponse.json(
      { error: "Speichern fehlgeschlagen." },
      { status: 500 },
    );
  }
}
