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

function getCode(req: NextRequest): string | null {
  return normalizeCode(req.nextUrl.searchParams.get("code") ?? "");
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ hash: string }> },
) {
  try {
    const code = getCode(req);
    if (!code) {
      return NextResponse.json(
        { error: "Ungültiger Familien-Code." },
        { status: 400 },
      );
    }
    const { hash } = await params;
    const [library, progress] = await Promise.all([
      loadLibrary(code),
      loadProgress(code),
    ]);
    const nextLib = library.filter((e) => e.materialHash !== hash);
    delete progress[hash];
    await Promise.all([
      redis().set(libraryKey(code), JSON.stringify(nextLib)),
      redis().set(progressKey(code), JSON.stringify(progress)),
    ]);
    return NextResponse.json({ library: nextLib, progress });
  } catch (err) {
    console.error("[library DELETE] error:", err);
    return NextResponse.json(
      { error: "Löschen fehlgeschlagen." },
      { status: 500 },
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ hash: string }> },
) {
  try {
    const code = getCode(req);
    if (!code) {
      return NextResponse.json(
        { error: "Ungültiger Familien-Code." },
        { status: 400 },
      );
    }
    const { hash } = await params;
    const body = (await req.json()) as { displayName?: string };
    const library = await loadLibrary(code);
    const idx = library.findIndex((e) => e.materialHash === hash);
    if (idx < 0) {
      return NextResponse.json(
        { error: "Eintrag nicht gefunden." },
        { status: 404 },
      );
    }
    const name = (body.displayName ?? "").trim();
    library[idx] = {
      ...library[idx],
      displayName: name || undefined,
    };
    await redis().set(libraryKey(code), JSON.stringify(library));
    return NextResponse.json({ library });
  } catch (err) {
    console.error("[library PATCH] error:", err);
    return NextResponse.json(
      { error: "Umbenennen fehlgeschlagen." },
      { status: 500 },
    );
  }
}
