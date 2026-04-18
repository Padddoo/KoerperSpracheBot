import { NextRequest, NextResponse } from "next/server";
import { openai, TTS_VOICE } from "@/lib/openai";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { text } = (await req.json()) as { text?: string };

    if (!text || !text.trim()) {
      return NextResponse.json({ error: "Kein Text." }, { status: 400 });
    }

    const speech = await openai().audio.speech.create({
      model: "tts-1",
      voice: TTS_VOICE,
      input: text,
      response_format: "mp3",
    });

    const arrayBuffer = await speech.arrayBuffer();

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[tts] error:", err);
    return NextResponse.json(
      { error: "Stimme konnte nicht erzeugt werden." },
      { status: 500 },
    );
  }
}
