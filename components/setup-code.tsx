"use client";

import { useState } from "react";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface Props {
  onSubmit: (code: string) => void;
}

export function SetupCode({ onSubmit }: Props) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const normalize = (raw: string): string | null => {
    const clean = raw.trim().toLowerCase().replace(/\s+/g, "-");
    if (!/^[a-z0-9][a-z0-9-]{1,40}[a-z0-9]$/i.test(clean)) return null;
    return clean;
  };

  const submit = () => {
    const normalized = normalize(value);
    if (!normalized) {
      setError(
        "Bitte 3–40 Zeichen, nur Buchstaben, Zahlen und Bindestriche.",
      );
      return;
    }
    onSubmit(normalized);
  };

  return (
    <main className="min-h-screen bg-bg px-4 py-10">
      <div className="mx-auto w-full max-w-xl space-y-5">
        <div className="text-center">
          <h1 className="font-display text-4xl text-fg">Hallo!</h1>
          <p className="mt-2 text-fg/70">
            Lass uns Fred einrichten.
          </p>
        </div>

        <Card>
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-accent-soft text-accent">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <div className="font-semibold">Familien-Code</div>
                <p className="text-sm text-fg/60">
                  Gib einen beliebigen Code ein — alle Geräte mit dem
                  gleichen Code teilen sich Freds Bibliothek und
                  Fortschritt.
                </p>
              </div>
            </div>

            <div>
              <input
                autoFocus
                inputMode="text"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  setError(null);
                }}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                placeholder="z.B. fred-mueller"
                className="w-full rounded-xl border-2 border-fg/15 bg-white px-4 py-3 text-lg font-semibold text-fg outline-none focus:border-accent"
              />
              {error && (
                <p className="mt-2 text-sm text-red-700">{error}</p>
              )}
              <p className="mt-2 text-xs text-fg/50">
                Keine Leerzeichen, Buchstaben/Zahlen/Bindestriche, 3–40 Zeichen.
                Tipp: Was Einzigartiges wählen — das ist euer einziger
                „Schlüssel" zur Bibliothek.
              </p>
            </div>

            <Button
              onClick={submit}
              variant="primary"
              size="lg"
              className="w-full touch-target"
            >
              Loslegen
            </Button>
          </div>
        </Card>

        <p className="text-center text-xs text-fg/50">
          Auf weiteren Geräten gleichen Code eingeben → gleiche Materialien.
          Der Code kann später im Einstellungsmenü geändert werden.
        </p>
      </div>
    </main>
  );
}
