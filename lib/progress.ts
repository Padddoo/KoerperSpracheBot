import type { ProgressForMaterial, TopicStats, Verdict } from "@/types";

const KEY_PREFIX = "fred-lernt.progress.v1.";

function storageKey(materialHash: string): string {
  return `${KEY_PREFIX}${materialHash}`;
}

function emptyStats(): TopicStats {
  return { correct: 0, partial: 0, incorrect: 0, lastAskedAt: 0 };
}

export function loadProgress(materialHash: string): ProgressForMaterial {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(storageKey(materialHash));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as ProgressForMaterial;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function saveProgress(
  materialHash: string,
  progress: ProgressForMaterial,
): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(storageKey(materialHash), JSON.stringify(progress));
  } catch (err) {
    console.warn("progress save failed", err);
  }
}

export function recordTurn(
  materialHash: string,
  topic: string,
  verdict: Verdict,
): ProgressForMaterial {
  const progress = loadProgress(materialHash);
  const current = progress[topic] ?? emptyStats();
  const updated: TopicStats = {
    ...current,
    lastAskedAt: Date.now(),
  };
  if (verdict === "correct") updated.correct += 1;
  else if (verdict === "partial") updated.partial += 1;
  else if (verdict === "incorrect") updated.incorrect += 1;
  // "none" verändert nichts außer dem Zeitstempel
  progress[topic] = updated;
  saveProgress(materialHash, progress);
  return progress;
}

export function clearProgress(materialHash: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(storageKey(materialHash));
  } catch {
    // ignore
  }
}

export function totalsForMaterial(
  progress: ProgressForMaterial,
): { correct: number; partial: number; incorrect: number } {
  let correct = 0,
    partial = 0,
    incorrect = 0;
  for (const stats of Object.values(progress)) {
    correct += stats.correct;
    partial += stats.partial;
    incorrect += stats.incorrect;
  }
  return { correct, partial, incorrect };
}
