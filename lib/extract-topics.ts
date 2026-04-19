import {
  anthropic,
  HAIKU_MODEL,
  TOPIC_EXTRACTION_PROMPT,
} from "@/lib/anthropic";

export async function extractTopics(material: string): Promise<string[]> {
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
        .filter(
          (t): t is string => typeof t === "string" && t.trim().length > 0,
        )
        .map((t) => t.trim())
        .slice(0, 8);
      if (clean.length > 0) return clean;
    }
  } catch {
    // fall through
  }
  console.warn("[topic-extract] Themen-Extraktion lieferte kein valides JSON:", text);
  return ["Allgemein"];
}
