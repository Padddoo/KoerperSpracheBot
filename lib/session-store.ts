interface StoredSession {
  material: string;
  filenames: string[];
  updatedAt: number;
}

declare global {
  // eslint-disable-next-line no-var
  var __fredSessionStore: Map<string, StoredSession> | undefined;
}

const SESSION_TTL_MS = 1000 * 60 * 60 * 12;

function getStore(): Map<string, StoredSession> {
  if (!globalThis.__fredSessionStore) {
    globalThis.__fredSessionStore = new Map();
  }
  return globalThis.__fredSessionStore;
}

export function saveSession(
  sessionId: string,
  material: string,
  filenames: string[],
) {
  const store = getStore();
  store.set(sessionId, { material, filenames, updatedAt: Date.now() });
  cleanupExpired();
}

export function getSession(sessionId: string): StoredSession | undefined {
  const store = getStore();
  const entry = store.get(sessionId);
  if (!entry) return undefined;
  if (Date.now() - entry.updatedAt > SESSION_TTL_MS) {
    store.delete(sessionId);
    return undefined;
  }
  return entry;
}

function cleanupExpired() {
  const store = getStore();
  const now = Date.now();
  for (const [id, entry] of store.entries()) {
    if (now - entry.updatedAt > SESSION_TTL_MS) store.delete(id);
  }
}

export function createSessionId(): string {
  return `ses_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
