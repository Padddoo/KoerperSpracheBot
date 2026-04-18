import { NextRequest, NextResponse } from "next/server";
import { normalizeCode, progressKey, redis } from "@/lib/kv";
import type { ProgressForMaterial } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 30;

type ProgressMap = Record<string, ProgressForMaterial>;

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

/** Body: { materialHash: string, progress: ProgressForMaterial } */
export async function POST(req: NextRequest) {
  try {
    const code = normalizeCode(req.nextUrl.searchParams.get("code") ?? "");
    if (!code) {
      return NextResponse.json(
        { error: "Ungültiger Familien-Code." },
        { status: 400 },
      );
    }
    const body = (await req.json()) as {
      materialHash?: string;
      progress?: ProgressForMaterial;
    };
    if (!body.materialHash || !body.progress) {
      return NextResponse.json(
        { error: "Daten unvollständig." },
        { status: 400 },
      );
    }
    const all = await loadProgress(code);
    all[body.materialHash] = body.progress;
    await redis().set(progressKey(code), JSON.stringify(all));
    return NextResponse.json({ progress: all });
  } catch (err) {
    console.error("[progress POST] error:", err);
    return NextResponse.json(
      { error: "Speichern fehlgeschlagen." },
      { status: 500 },
    );
  }
}

/** Clear progress for a specific material. */
export async function DELETE(req: NextRequest) {
  try {
    const code = normalizeCode(req.nextUrl.searchParams.get("code") ?? "");
    const hash = req.nextUrl.searchParams.get("hash");
    if (!code || !hash) {
      return NextResponse.json(
        { error: "Code oder Hash fehlt." },
        { status: 400 },
      );
    }
    const all = await loadProgress(code);
    delete all[hash];
    await redis().set(progressKey(code), JSON.stringify(all));
    return NextResponse.json({ progress: all });
  } catch (err) {
    console.error("[progress DELETE] error:", err);
    return NextResponse.json(
      { error: "Löschen fehlgeschlagen." },
      { status: 500 },
    );
  }
}
