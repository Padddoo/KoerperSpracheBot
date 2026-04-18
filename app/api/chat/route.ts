import { NextRequest } from "next/server";
import { anthropic, CLAUDE_MODEL, buildCoachSystem } from "@/lib/anthropic";
import {
  extractSpokenPartial,
  splitSentences,
  tryParseCoachOutput,
} from "@/lib/coach-parse";
import type { Message, Verdict } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 60;

interface ChatRequest {
  material: string;
  topics: string[];
  userMessage: string;
  history: Message[];
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

function sseEncode(obj: unknown): string {
  return `data: ${JSON.stringify(obj)}\n\n`;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ChatRequest;
    const { material, topics, userMessage, history } = body;

    if (!material || !userMessage) {
      return new Response(
        JSON.stringify({ error: "Material und Nachricht sind erforderlich." }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const safeTopics =
      Array.isArray(topics) && topics.length > 0 ? topics : ["Allgemein"];

    const messages = [
      ...(history ?? []).map((m) => ({ role: m.role, content: m.content })),
      { role: "user" as const, content: userMessage },
    ];

    const encoder = new TextEncoder();

    const readable = new ReadableStream<Uint8Array>({
      async start(controller) {
        let raw = "";
        let pendingTail = "";
        let emittedSpokenLength = 0;

        try {
          const stream = anthropic().messages.stream({
            model: CLAUDE_MODEL,
            max_tokens: 500,
            system: [
              { type: "text", text: buildCoachSystem(safeTopics) },
              {
                type: "text",
                text: `<lernmaterial>\n${material}\n</lernmaterial>`,
                cache_control: { type: "ephemeral" },
              },
            ],
            messages,
          });

          for await (const event of stream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              raw += event.delta.text;
              const { spoken } = extractSpokenPartial(raw);
              if (spoken.length > emittedSpokenLength) {
                const newPart = spoken.slice(emittedSpokenLength);
                emittedSpokenLength = spoken.length;
                pendingTail += newPart;
                const { sentences, rest } = splitSentences(pendingTail);
                pendingTail = rest;
                for (const s of sentences) {
                  controller.enqueue(
                    encoder.encode(sseEncode({ type: "sentence", text: s })),
                  );
                }
              }
            }
          }

          const finalMessage = await stream.finalMessage();
          logCostEstimate(finalMessage.usage);

          const fullRaw = finalMessage.content
            .filter((b) => b.type === "text")
            .map((b) => (b.type === "text" ? b.text : ""))
            .join("")
            .trim();

          const parsed = tryParseCoachOutput(fullRaw);

          // Restlichen Text im Puffer rausgeben (falls kein sauberer Satzabschluss)
          const remainingTail = pendingTail.trim();
          if (remainingTail) {
            controller.enqueue(
              encoder.encode(
                sseEncode({ type: "sentence", text: remainingTail }),
              ),
            );
          }

          if (parsed) {
            controller.enqueue(
              encoder.encode(
                sseEncode({
                  type: "final",
                  full: parsed.spoken,
                  topic: parsed.topic,
                  verdict: parsed.verdict,
                }),
              ),
            );
          } else {
            console.warn(
              "[chat] Antwort war kein valides JSON:",
              fullRaw.slice(0, 200),
            );
            controller.enqueue(
              encoder.encode(
                sseEncode({
                  type: "final",
                  full: fullRaw || "Entschuldige, sag nochmal.",
                  topic: "sonstiges",
                  verdict: "none" as Verdict,
                }),
              ),
            );
          }
        } catch (err) {
          console.error("[chat stream] error:", err);
          controller.enqueue(
            encoder.encode(
              sseEncode({
                type: "error",
                error:
                  "Entschuldige, da ist etwas schiefgegangen. Versuch's gleich nochmal.",
              }),
            ),
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (err) {
    console.error("[chat] error:", err);
    return new Response(
      JSON.stringify({
        error:
          "Entschuldige, da ist etwas schiefgegangen. Versuch's gleich nochmal.",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
