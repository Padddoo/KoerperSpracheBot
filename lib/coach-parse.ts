import type { Verdict } from "@/types";

export interface CoachOutput {
  spoken: string;
  topic: string;
  verdict: Verdict;
}

const VALID_VERDICTS: ReadonlySet<Verdict> = new Set([
  "correct",
  "partial",
  "incorrect",
  "none",
]);

export function tryParseCoachOutput(raw: string): CoachOutput | null {
  let text = raw.trim();
  if (text.startsWith("```")) {
    text = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  }
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

/**
 * Extract the "spoken" field value from a partial JSON string.
 * Returns the characters collected so far (with escapes unescaped) and
 * whether the closing quote of the string has been seen.
 */
export function extractSpokenPartial(raw: string): {
  spoken: string;
  closed: boolean;
} {
  const keyMatch = raw.match(/"spoken"\s*:\s*"/);
  if (!keyMatch || keyMatch.index === undefined) {
    return { spoken: "", closed: false };
  }
  const start = keyMatch.index + keyMatch[0].length;
  let i = start;
  let out = "";
  while (i < raw.length) {
    const ch = raw[i];
    if (ch === "\\") {
      if (i + 1 >= raw.length) break; // warten auf mehr
      const next = raw[i + 1];
      if (next === '"') out += '"';
      else if (next === "\\") out += "\\";
      else if (next === "/") out += "/";
      else if (next === "n") out += "\n";
      else if (next === "r") out += "\r";
      else if (next === "t") out += "\t";
      else if (next === "b") out += "\b";
      else if (next === "f") out += "\f";
      else if (next === "u") {
        if (i + 5 >= raw.length) break;
        const hex = raw.slice(i + 2, i + 6);
        out += String.fromCharCode(parseInt(hex, 16));
        i += 4;
      } else out += next;
      i += 2;
    } else if (ch === '"') {
      return { spoken: out, closed: true };
    } else {
      out += ch;
      i++;
    }
  }
  return { spoken: out, closed: false };
}

/**
 * From a buffer of text, split off any fully-formed sentences.
 * A sentence ends in `.`, `!`, `?` followed by whitespace or end-of-buffer.
 * Returns emitted sentences and the remaining (incomplete) tail.
 */
export function splitSentences(buffer: string): {
  sentences: string[];
  rest: string;
} {
  const sentences: string[] = [];
  let cursor = 0;
  for (let i = 0; i < buffer.length; i++) {
    const c = buffer[i];
    if (c === "." || c === "!" || c === "?") {
      const next = buffer[i + 1];
      const atEnd = i === buffer.length - 1;
      if (atEnd || next === " " || next === "\n" || next === "\t") {
        const s = buffer.slice(cursor, i + 1).trim();
        if (s) sentences.push(s);
        let k = i + 1;
        while (k < buffer.length && /\s/.test(buffer[k])) k++;
        cursor = k;
        i = k - 1;
      }
    }
  }
  return { sentences, rest: buffer.slice(cursor) };
}
