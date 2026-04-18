import OpenAI from "openai";

let _client: OpenAI | null = null;

export function openai(): OpenAI {
  if (!_client) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error(
        "OPENAI_API_KEY ist nicht gesetzt. Bitte in .env.local eintragen.",
      );
    }
    _client = new OpenAI();
  }
  return _client;
}

export const TTS_VOICE = (process.env.OPENAI_TTS_VOICE || "shimmer") as
  | "alloy"
  | "echo"
  | "fable"
  | "onyx"
  | "nova"
  | "shimmer";
