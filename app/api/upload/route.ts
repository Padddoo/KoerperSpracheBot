import { NextRequest, NextResponse } from "next/server";
import { extractTextFromFile } from "@/lib/extract-text";
import { extractTopics } from "@/lib/extract-topics";
import { hashMaterial } from "@/lib/material-hash";

export const runtime = "nodejs";
export const maxDuration = 60;

function createSessionId(): string {
  return `ses_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const files = formData.getAll("files").filter((f): f is File => f instanceof File);

    if (files.length === 0) {
      return NextResponse.json(
        { error: "Keine Datei hochgeladen." },
        { status: 400 },
      );
    }

    const extracted = await Promise.all(files.map(extractTextFromFile));
    const filenames = extracted.map((e) => e.filename);
    const combinedText = extracted
      .map((e) => `--- ${e.filename} ---\n${e.text.trim()}`)
      .join("\n\n")
      .trim();

    if (combinedText.length === 0) {
      return NextResponse.json(
        {
          error:
            "Aus den Dateien konnte kein Text gelesen werden. Ist die PDF vielleicht ein Scan?",
        },
        { status: 400 },
      );
    }

    const materialHash = hashMaterial(combinedText);
    const topics = await extractTopics(combinedText);

    return NextResponse.json({
      sessionId: createSessionId(),
      filenames,
      charCount: combinedText.length,
      material: combinedText,
      topics,
      materialHash,
    });
  } catch (err) {
    console.error("[upload] error:", err);
    const message =
      err instanceof Error ? err.message : "Upload fehlgeschlagen.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
