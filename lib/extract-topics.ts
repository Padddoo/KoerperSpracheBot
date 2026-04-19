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

  const rawText = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("")
    .trim();

  // Robustes Parsing: Code-Fences entfernen, erstes JSON-Objekt finden
  const topics = parseTopicsFromText(rawText);
  if (topics.length > 0) return topics;

  console.warn(
    "[topic-extract] Themen-Extraktion lieferte kein valides JSON:",
    rawText.slice(0, 200),
  );
  return ["Allgemein"];
}

function parseTopicsFromText(raw: string): string[] {
  let text = raw.trim();
  // Code-Fences abstreifen
  if (text.startsWith("```")) {
    text = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  }
  // Erstes JSON-Objekt im Text isolieren
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first >= 0 && last > first) {
    text = text.slice(first, last + 1);
  }
  try {
    const parsed = JSON.parse(text) as { topics?: unknown };
    if (Array.isArray(parsed.topics)) {
      return parsed.topics
        .filter(
          (t): t is string => typeof t === "string" && t.trim().length > 0,
        )
        .map((t) => t.trim())
        .slice(0, 8);
    }
  } catch {
    // ignore
  }
  // Fallback: Array-Muster suchen (z.B. wenn Haiku nur ein Array ohne Wrapping liefert)
  const arrayMatch = raw.match(/\[\s*"[^"]+"(?:\s*,\s*"[^"]+")*\s*\]/);
  if (arrayMatch) {
    try {
      const arr = JSON.parse(arrayMatch[0]) as unknown;
      if (Array.isArray(arr)) {
        return arr
          .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
          .map((t) => t.trim())
          .slice(0, 8);
      }
    } catch {
      // ignore
    }
  }
  return [];
}
