import { NextRequest, NextResponse } from "next/server";
import { extractTextFromFile } from "@/lib/extract-text";
import {
  anthropic,
  HAIKU_MODEL,
  TOPIC_EXTRACTION_PROMPT,
} from "@/lib/anthropic";
import { hashMaterial } from "@/lib/material-hash";

export const runtime = "nodejs";
export const maxDuration = 60;

function createSessionId(): string {
  return `ses_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

async function extractTopics(material: string): Promise<string[]> {
  // Haiku reicht für einmalige Themen-Extraktion und spart Kosten
  const truncated =
    material.length > 40_000 ? material.slice(0, 40_000) : material;

  const response = await anthropic().messages.create({
    model: HAIKU_MODEL,
    max_tokens: 300,
    system: TOPIC_EXTRACTION_PROMPT,
    messages: [{ role: "user", content: truncated }],
  });

  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("")
    .trim();

  try {
    const parsed = JSON.parse(text) as { topics?: unknown };
    if (Array.isArray(parsed.topics)) {
      const clean = parsed.topics
        .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
        .map((t) => t.trim())
        .slice(0, 8);
      if (clean.length > 0) return clean;
    }
  } catch {
    // fall through
  }
  console.warn("[upload] Themen-Extraktion lieferte kein valides JSON:", text);
  return ["Allgemein"];
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
