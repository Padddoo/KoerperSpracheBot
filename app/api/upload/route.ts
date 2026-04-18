import { NextRequest, NextResponse } from "next/server";
import { extractTextFromFile } from "@/lib/extract-text";
import { saveSession, createSessionId } from "@/lib/session-store";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const files = formData.getAll("files").filter((f): f is File => f instanceof File);
    const existingSessionId = formData.get("sessionId");

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

    const sessionId =
      typeof existingSessionId === "string" && existingSessionId
        ? existingSessionId
        : createSessionId();

    saveSession(sessionId, combinedText, filenames);

    return NextResponse.json({
      sessionId,
      filenames,
      charCount: combinedText.length,
    });
  } catch (err) {
    console.error("[upload] error:", err);
    const message =
      err instanceof Error ? err.message : "Upload fehlgeschlagen.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
