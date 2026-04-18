import { NextRequest, NextResponse } from "next/server";
import {
  anthropic,
  CLAUDE_MODEL,
  buildCoachSystem,
} from "@/lib/anthropic";
import type { Message, Verdict } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 60;

interface ChatRequest {
  material: string;
  topics: string[];
  userMessage: string;
  history: Message[];
}

interface CoachOutput {
  spoken: string;
  topic: string;
  verdict: Verdict;
}

function logCostEstimate(usage: {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
}) {
  const input = usage.input_tokens ?? 0;
  const output = usage.output_tokens ?? 0;
  const cacheWrite = usage.cache_creation_input_tokens ?? 0;
  const cacheRead = usage.cache_read_input_tokens ?? 0;
  const costUsd =
    (input / 1_000_000) * 3 +
    (output / 1_000_000) * 15 +
    (cacheWrite / 1_000_000) * 3.75 +
    (cacheRead / 1_000_000) * 0.3;
  const costCents = (costUsd * 100).toFixed(3);
  console.log(
    `[chat cost] in=${input} out=${output} cache_write=${cacheWrite} cache_read=${cacheRead} ≈ ${costCents}¢`,
  );
}

const VALID_VERDICTS: ReadonlySet<Verdict> = new Set([
  "correct",
  "partial",
  "incorrect",
  "none",
]);

function tryParseCoachOutput(raw: string): CoachOutput | null {
  // Entferne evtl. code-fences
  let text = raw.trim();
  if (text.startsWith("```")) {
    text = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  }
  // Suche das erste JSON-Objekt im Text
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    text = text.slice(firstBrace, lastBrace + 1);
  }
  try {
    const obj = JSON.parse(text) as Partial<CoachOutput>;
    if (
      typeof obj.spoken === "string" &&
      typeof obj.topic === "string" &&
      typeof obj.verdict === "string" &&
      VALID_VERDICTS.has(obj.verdict as Verdict)
    ) {
      return {
        spoken: obj.spoken.trim(),
        topic: obj.topic.trim(),
        verdict: obj.verdict as Verdict,
      };
    }
  } catch {
    // fall through
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ChatRequest;
    const { material, topics, userMessage, history } = body;

    if (!material || !userMessage) {
      return NextResponse.json(
        { error: "Material und Nachricht sind erforderlich." },
        { status: 400 },
      );
    }

    const safeTopics =
      Array.isArray(topics) && topics.length > 0 ? topics : ["Allgemein"];

    const messages = [
      ...(history ?? []).map((m) => ({ role: m.role, content: m.content })),
      { role: "user" as const, content: userMessage },
    ];

    const response = await anthropic().messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 500,
      system: [
        {
          type: "text",
          text: buildCoachSystem(safeTopics),
        },
        {
          type: "text",
          text: `<lernmaterial>\n${material}\n</lernmaterial>`,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages,
    });

    logCostEstimate(response.usage);

    const rawText = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();

    const parsed = tryParseCoachOutput(rawText);
    if (parsed) {
      return NextResponse.json({
        assistantMessage: parsed.spoken,
        topic: parsed.topic,
        verdict: parsed.verdict,
      });
    }

    // Fallback: Klartext zurückgeben, kein Fortschritt gezählt
    console.warn("[chat] Antwort war kein valides JSON:", rawText.slice(0, 200));
    return NextResponse.json({
      assistantMessage: rawText || "Entschuldige, sag nochmal.",
      topic: "sonstiges",
      verdict: "none" as Verdict,
    });
  } catch (err) {
    console.error("[chat] error:", err);
    return NextResponse.json(
      {
        error:
          "Entschuldige, da ist etwas schiefgegangen. Versuch's gleich nochmal.",
      },
      { status: 500 },
    );
  }
}
