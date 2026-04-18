"use client";

import { useRef, useState } from "react";
import { UploadCloud, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { SessionInfo } from "@/types";

interface Props {
  onUploaded: (info: SessionInfo) => void;
}

export function UploadZone({ onUploaded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  async function handleFiles(files: FileList | File[]) {
    const arr = Array.from(files);
    if (arr.length === 0) return;

    setError(null);
    setIsUploading(true);
    try {
      const formData = new FormData();
      for (const f of arr) formData.append("files", f);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Hochladen hat nicht geklappt.");
      }

      const info = (await res.json()) as SessionInfo;
      onUploaded(info);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Hochladen hat nicht geklappt. Versuch's noch einmal.",
      );
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-xl space-y-4">
      <div className="text-center">
        <h1 className="font-display text-4xl text-fg">Hallo Fred!</h1>
        <p className="mt-2 text-fg/70">
          Lade Deine Lernmaterialien hoch, und wir legen los.
        </p>
      </div>

      <Card
        className={`border-dashed ${
          dragOver ? "border-accent bg-accent-soft/60" : "border-fg/20"
        }`}
      >
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (e.dataTransfer.files) handleFiles(e.dataTransfer.files);
          }}
          className="flex flex-col items-center justify-center gap-4 py-8 text-center"
        >
          {isUploading ? (
            <>
              <Loader2 className="h-12 w-12 animate-spin text-accent" />
              <p className="text-fg/70">Material wird gelesen…</p>
            </>
          ) : (
            <>
              <UploadCloud className="h-12 w-12 text-accent" />
              <div>
                <p className="font-semibold">
                  PDF oder DOCX hier ablegen
                </p>
                <p className="text-sm text-fg/60">
                  oder eine Datei auswählen
                </p>
              </div>
              <Button
                type="button"
                onClick={() => inputRef.current?.click()}
                variant="primary"
                size="lg"
                className="touch-target"
              >
                <FileText className="h-5 w-5" />
                Datei auswählen
              </Button>
              <input
                ref={inputRef}
                type="file"
                accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) handleFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </>
          )}
        </div>
      </Card>

      {error && (
        <div className="rounded-xl bg-red-50 p-4 text-center text-sm text-red-800">
          {error}
        </div>
      )}

      <p className="text-center text-xs text-fg/50">
        Dein Material bleibt in dieser Sitzung. Keine Anmeldung nötig.
      </p>
    </div>
  );
}
