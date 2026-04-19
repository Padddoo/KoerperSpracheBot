import { NextRequest, NextResponse } from "next/server";
import { openai, TTS_VOICE } from "@/lib/openai";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_TEXT_CHARS = 4000;

async function synthesize(text: string): Promise<Response> {
  const trimmed = text.trim();
  if (!trimmed) {
    return NextResponse.json({ error: "Kein Text." }, { status: 400 });
  }
  if (trimmed.length > MAX_TEXT_CHARS) {
    return NextResponse.json(
      { error: "Text zu lang." },
      { status: 400 },
    );
  }

  try {
    const speech = await openai().audio.speech.create({
      model: "tts-1",
      voice: TTS_VOICE,
      input: trimmed,
      response_format: "mp3",
    });

    // Vollständiges MP3 zurückgeben — der Web-Audio-API-Client
    // braucht sowieso den ganzen Buffer für decodeAudioData.
    // Manuelles Transfer-Encoding: chunked weggelassen (konfligiert mit
    // Node's automatischem Streaming-Handling auf Vercel).
    const arrayBuffer = await speech.arrayBuffer();
    return new Response(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
        "Content-Length": String(arrayBuffer.byteLength),
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

export async function GET(req: NextRequest) {
  const text = req.nextUrl.searchParams.get("text") ?? "";
  return synthesize(text);
}

export async function POST(req: NextRequest) {
  try {
    const { text } = (await req.json()) as { text?: string };
    return synthesize(text ?? "");
  } catch {
    return NextResponse.json(
      { error: "Ungültige Anfrage." },
      { status: 400 },
    );
  }
}
