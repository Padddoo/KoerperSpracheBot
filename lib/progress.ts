import type { ProgressForMaterial, TopicStats, Verdict } from "@/types";

export function emptyStats(): TopicStats {
  return { correct: 0, partial: 0, incorrect: 0, lastAskedAt: 0 };
}

/** Pure: compute next state locally; caller syncs to server. */
export function applyTurn(
  progress: ProgressForMaterial,
  topic: string,
  verdict: Verdict,
): ProgressForMaterial {
  const current = progress[topic] ?? emptyStats();
  const updated: TopicStats = { ...current, lastAskedAt: Date.now() };
  if (verdict === "correct") updated.correct += 1;
  else if (verdict === "partial") updated.partial += 1;
  else if (verdict === "incorrect") updated.incorrect += 1;
  return { ...progress, [topic]: updated };
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
