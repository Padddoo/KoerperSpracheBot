"use client";

import { useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  CircleDot,
  RotateCcw,
} from "lucide-react";
import type { ProgressForMaterial } from "@/types";
import { masteryOf, totalsForMaterial } from "@/lib/progress";
import { cn } from "@/lib/utils";

interface Props {
  currentTopic: string | null;
  topics: string[];
  progress: ProgressForMaterial;
  onReset: () => void;
}

export function ProgressPill({ currentTopic, topics, progress, onReset }: Props) {
  const [expanded, setExpanded] = useState(false);
  const totals = totalsForMaterial(progress);
  const hasActivity =
    totals.correct + totals.partial + totals.incorrect > 0;

  const prettyTopic = (t: string | null): string => {
    if (!t) return "—";
    if (t === "einführung") return "Einführung";
    if (t === "sonstiges") return "—";
    return t;
  };

  return (
    <div className="mx-auto w-full max-w-xl px-4 pt-3">
      <div className="rounded-2xl border-2 border-fg bg-white shadow-comic-sm">
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left"
          aria-expanded={expanded}
        >
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-fg/50">
              Jetzt
            </span>
            <span className="truncate font-semibold text-fg">
              {prettyTopic(currentTopic)}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm tabular-nums">
            <Score label="✓" value={totals.correct} tone="good" />
            <Score label="~" value={totals.partial} tone="mid" />
            <Score label="✗" value={totals.incorrect} tone="bad" />
            {expanded ? (
              <ChevronUp className="h-4 w-4 text-fg/50" />
            ) : (
              <ChevronDown className="h-4 w-4 text-fg/50" />
            )}
          </div>
        </button>

        {expanded && (
          <div className="border-t-2 border-fg px-4 py-3">
            <div className="flex flex-col gap-2">
              {topics.map((t) => {
                const s = progress[t];
                const c = s?.correct ?? 0;
                const p = s?.partial ?? 0;
                const i = s?.incorrect ?? 0;
                const total = c + p + i;
                const pct = total === 0 ? 0 : (c + 0.5 * p) / total;
                const status = masteryOf(s);
                return (
                  <div
                    key={t}
                    className={cn(
                      "flex items-center justify-between gap-3",
                      currentTopic === t && "font-semibold",
                    )}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <StatusIcon status={status} />
                      <span className="truncate text-sm text-fg/80">{t}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs tabular-nums text-fg/70">
                      <div className="h-1.5 w-20 rounded-full bg-fg/10">
                        <div
                          className={cn(
                            "h-1.5 rounded-full",
                            status === "mastered"
                              ? "bg-emerald-600"
                              : "bg-accent",
                          )}
                          style={{ width: `${Math.round(pct * 100)}%` }}
                        />
                      </div>
                      <span className="w-10 text-right">
                        {c}/{total}
                      </span>
                    </div>
                  </div>
                );
              })}
              {hasActivity && (
                <button
                  type="button"
                  onClick={onReset}
                  className="mt-2 inline-flex items-center gap-1.5 self-start rounded-lg px-2 py-1 text-xs text-fg/60 hover:bg-accent-soft hover:text-fg"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Fortschritt zurücksetzen
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusIcon({
  status,
}: {
  status: "mastered" | "in_progress" | "untouched";
}) {
  if (status === "mastered") {
    return (
      <CheckCircle2
        className="h-4 w-4 flex-none text-emerald-600"
        aria-label="Gemeistert"
      />
    );
  }
  if (status === "in_progress") {
    return (
      <CircleDot
        className="h-4 w-4 flex-none text-accent"
        aria-label="Im Training"
      />
    );
  }
  return (
    <Circle
      className="h-4 w-4 flex-none text-fg/30"
      aria-label="Noch nicht geübt"
    />
  );
}

function Score({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "good" | "mid" | "bad";
}) {
  const color =
    tone === "good"
      ? "text-emerald-700"
      : tone === "mid"
        ? "text-amber-700"
        : "text-rose-700";
  if (value === 0)
    return <span className="text-fg/30">{label}0</span>;
  return (
    <span className={cn("font-semibold", color)}>
      {label}
      {value}
    </span>
  );
}
