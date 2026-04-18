import { Redis } from "@upstash/redis";

let _redis: Redis | null = null;

export function redis(): Redis {
  if (!_redis) {
    const url =
      process.env.UPSTASH_REDIS_REST_URL ??
      process.env.KV_REST_API_URL ??
      process.env.REDIS_URL;
    const token =
      process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
    if (!url || !token) {
      throw new Error(
        "Redis ist nicht konfiguriert. Bitte 'Upstash for Redis' in Vercel → Storage hinzufügen.",
      );
    }
    _redis = new Redis({ url, token });
  }
  return _redis;
}

const CODE_RE = /^[a-z0-9][a-z0-9-]{1,40}[a-z0-9]$/i;

export function normalizeCode(raw: string): string | null {
  const clean = raw.trim().toLowerCase().replace(/\s+/g, "-");
  if (!CODE_RE.test(clean)) return null;
  return clean;
}

export const libraryKey = (code: string) => `fred:library:${code}`;
export const progressKey = (code: string) => `fred:progress:${code}`;
