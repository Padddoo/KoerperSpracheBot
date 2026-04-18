import { NextRequest, NextResponse } from "next/server";
import { openai } from "@/lib/openai";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audio = formData.get("audio");

    if (!(audio instanceof File)) {
      return NextResponse.json(
        { error: "Keine Aufnahme empfangen." },
        { status: 400 },
      );
    }

    const transcription = await openai().audio.transcriptions.create({
      file: audio,
      model: "whisper-1",
      language: "de",
    });

    return NextResponse.json({ text: transcription.text });
  } catch (err) {
    console.error("[transcribe] error:", err);
    return NextResponse.json(
      { error: "Entschuldige, ich konnte Dich nicht verstehen. Versuch's nochmal." },
      { status: 500 },
    );
  }
}
