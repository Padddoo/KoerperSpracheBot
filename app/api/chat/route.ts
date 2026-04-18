import { NextRequest, NextResponse } from "next/server";
import { anthropic, CLAUDE_MODEL, SYSTEM_PROMPT } from "@/lib/anthropic";
import type { Message } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 60;

interface ChatRequest {
  material: string;
  userMessage: string;
  history: Message[];
}

// Rough cost estimate (USD) for Sonnet 4.6: $3/MTok input, $15/MTok output.
// Cached input reads are ~$0.30/MTok.
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

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ChatRequest;
    const { material, userMessage, history } = body;

    if (!material || !userMessage) {
      return NextResponse.json(
        { error: "Material und Nachricht sind erforderlich." },
        { status: 400 },
      );
    }

    const messages = [
      ...(history ?? []).map((m) => ({ role: m.role, content: m.content })),
      { role: "user" as const, content: userMessage },
    ];

    const response = await anthropic().messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 400,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
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

    const assistantMessage = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();

    return NextResponse.json({ assistantMessage });
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
