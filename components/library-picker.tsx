"use client";

import { useState } from "react";
import {
  CheckCircle2,
  Circle,
  CircleDot,
  FileText,
  Loader2,
  Plus,
  Trash2,
  Pencil,
  Check,
  Sparkles,
  X,
} from "lucide-react";
import type { LibraryEntry, ProgressForMaterial } from "@/types";
import { displayNameFor, relativeTime } from "@/lib/library";
import { masteryOf, totalsForMaterial } from "@/lib/progress";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ProgressMap = Record<string, ProgressForMaterial>;

interface Props {
  library: LibraryEntry[];
  progress: ProgressMap;
  onSelect: (entry: LibraryEntry) => void;
  onNewUpload: () => void;
  onDelete: (entry: LibraryEntry) => void | Promise<void>;
  onRename: (entry: LibraryEntry, newName: string) => void | Promise<void>;
  onReextract?: (entry: LibraryEntry) => void | Promise<void>;
  onChangeCode: () => void;
}

export function LibraryPicker({
  library,
  progress,
  onSelect,
  onNewUpload,
  onDelete,
  onRename,
  onReextract,
  onChangeCode,
}: Props) {
  const sorted = [...library].sort((a, b) => b.lastUsedAt - a.lastUsedAt);
  const [editingHash, setEditingHash] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [extractingHash, setExtractingHash] = useState<string | null>(null);

  const startRename = (entry: LibraryEntry) => {
    setEditingHash(entry.materialHash);
    setEditValue(displayNameFor(entry));
  };

  const confirmRename = async () => {
    if (editingHash) {
      const entry = library.find((e) => e.materialHash === editingHash);
      if (entry) await onRename(entry, editValue);
    }
    setEditingHash(null);
  };

  const handleDelete = async (entry: LibraryEntry) => {
    if (
      confirm(
        `"${displayNameFor(entry)}" wirklich aus der Bibliothek entfernen? Der Lernfortschritt wird ebenfalls gelöscht.`,
      )
    ) {
      await onDelete(entry);
    }
  };

  return (
    <main className="min-h-screen bg-bg px-4 py-8">
      <div className="mx-auto w-full max-w-xl space-y-6">
        <div className="text-center">
          <h1 className="font-display text-4xl text-fg">Hallo Fred!</h1>
          <p className="mt-2 text-fg/70">
            Womit möchtest Du heute üben?
          </p>
        </div>

        <div className="space-y-3">
          {sorted.map((entry) => {
            const p = progress[entry.materialHash] ?? {};
            const totals = totalsForMaterial(p);
            const hasActivity =
              totals.correct + totals.partial + totals.incorrect > 0;
            const isEditing = editingHash === entry.materialHash;

            return (
              <div
                key={entry.materialHash}
                className={cn(
                  "rounded-2xl border-2 border-fg bg-white shadow-comic-sm transition-all",
                  !isEditing &&
                    "hover:-translate-y-[1px] hover:shadow-comic",
                )}
              >
                <div className="flex items-start gap-3 p-4">
                  <div className="flex h-11 w-11 flex-none items-center justify-center rounded-xl border-2 border-fg bg-accent-soft text-fg">
                    <FileText className="h-5 w-5" />
                  </div>
                  <button
                    type="button"
                    onClick={() => !isEditing && onSelect(entry)}
                    className="flex min-w-0 flex-1 flex-col text-left"
                    disabled={isEditing}
                  >
                    {isEditing ? (
                      <input
                        autoFocus
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") confirmRename();
                          if (e.key === "Escape") setEditingHash(null);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="rounded-md border border-accent/40 bg-white px-2 py-1 text-base font-semibold text-fg outline-none"
                      />
                    ) : (
                      <span className="truncate font-semibold text-fg">
                        {displayNameFor(entry)}
                      </span>
                    )}
                    <span className="mt-0.5 text-xs text-fg/60">
                      {entry.topics.length}{" "}
                      {entry.topics.length === 1 ? "Thema" : "Themen"} ·
                      zuletzt {relativeTime(entry.lastUsedAt)}
                    </span>
                    {hasActivity && (
                      <span className="mt-1 flex items-center gap-2 text-xs tabular-nums text-fg/70">
                        <span className="text-emerald-700">✓{totals.correct}</span>
                        <span className="text-amber-700">~{totals.partial}</span>
                        <span className="text-rose-700">✗{totals.incorrect}</span>
                      </span>
                    )}
                  </button>
                  <div className="flex flex-none items-center gap-1">
                    {isEditing ? (
                      <>
                        <IconBtn label="Speichern" onClick={confirmRename}>
                          <Check className="h-4 w-4" />
                        </IconBtn>
                        <IconBtn
                          label="Abbrechen"
                          onClick={() => setEditingHash(null)}
                        >
                          <X className="h-4 w-4" />
                        </IconBtn>
                      </>
                    ) : (
                      <>
                        <IconBtn
                          label="Umbenennen"
                          onClick={() => startRename(entry)}
                        >
                          <Pencil className="h-4 w-4" />
                        </IconBtn>
                        <IconBtn
                          label="Löschen"
                          onClick={() => handleDelete(entry)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </IconBtn>
                      </>
                    )}
                  </div>
                </div>
                {!isEditing && (() => {
                  const hasRealTopics =
                    entry.topics.length > 0 &&
                    !(entry.topics.length === 1 && entry.topics[0] === "Allgemein");
                  return (
                    <div className="w-full border-t-2 border-fg/10">
                      {hasRealTopics && (
                        <button
                          type="button"
                          onClick={() => onSelect(entry)}
                          className="w-full px-4 pb-2 pt-3 text-left"
                        >
                          <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                            {entry.topics.map((t) => {
                              const status = masteryOf(p[t]);
                              return (
                                <li
                                  key={t}
                                  className="flex items-center gap-1.5 text-sm text-fg/80"
                                >
                                  {status === "mastered" ? (
                                    <CheckCircle2 className="h-3.5 w-3.5 flex-none text-emerald-600" />
                                  ) : status === "in_progress" ? (
                                    <CircleDot className="h-3.5 w-3.5 flex-none text-accent" />
                                  ) : (
                                    <Circle className="h-3.5 w-3.5 flex-none text-fg/30" />
                                  )}
                                  <span className="truncate">{t}</span>
                                </li>
                              );
                            })}
                          </ul>
                        </button>
                      )}
                      {onReextract && (
                        <div className="px-4 pb-3 pt-2">
                          <button
                            type="button"
                            onClick={async () => {
                              if (extractingHash) return;
                              setExtractingHash(entry.materialHash);
                              try {
                                await onReextract(entry);
                              } finally {
                                setExtractingHash(null);
                              }
                            }}
                            disabled={extractingHash === entry.materialHash}
                            className="inline-flex items-center gap-1.5 rounded-lg border-2 border-fg/20 px-2 py-1 text-xs font-semibold text-fg/70 hover:bg-accent-soft hover:text-fg disabled:opacity-60"
                          >
                            {extractingHash === entry.materialHash ? (
                              <>
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                Analysiere…
                              </>
                            ) : (
                              <>
                                <Sparkles className="h-3.5 w-3.5" />
                                {hasRealTopics ? "Themen neu erkennen" : "Themen erkennen"}
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>

        <Button
          onClick={onNewUpload}
          variant="soft"
          size="lg"
          className="w-full touch-target"
        >
          <Plus className="h-5 w-5" />
          Neues Material hochladen
        </Button>

        <div className="flex items-center justify-center gap-2 text-xs text-fg/50">
          <button
            type="button"
            onClick={onChangeCode}
            className="underline underline-offset-2 hover:text-fg"
          >
            Familien-Code ändern
          </button>
        </div>
      </div>
    </main>
  );
}

function IconBtn({
  children,
  onClick,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-fg/50 hover:bg-accent-soft hover:text-fg"
    >
      {children}
    </button>
  );
}
