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

export type MasteryStatus = "mastered" | "in_progress" | "untouched";

/** "mastered" ab 3 richtigen Antworten mit Erfolgsquote ≥ 80%. */
export function masteryOf(stats: TopicStats | undefined): MasteryStatus {
  if (!stats) return "untouched";
  const total = stats.correct + stats.partial + stats.incorrect;
  if (total === 0) return "untouched";
  if (stats.correct >= 3 && stats.correct / total >= 0.8) return "mastered";
  return "in_progress";
}

