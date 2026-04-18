"use client";

import { Mic, Square, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type MicState = "idle" | "recording" | "processing" | "speaking";

interface Props {
  state: MicState;
  onClick: () => void;
  disabled?: boolean;
}

export function MicButton({ state, onClick, disabled }: Props) {
  const isRecording = state === "recording";
  const isProcessing = state === "processing";
  const isSpeaking = state === "speaking";

  return (
    <button
      onClick={onClick}
      disabled={disabled || isProcessing}
      aria-label={
        isRecording
          ? "Aufnahme stoppen"
          : isSpeaking
            ? "Vorlesen stoppen"
            : "Tippen zum Sprechen"
      }
      className={cn(
        "relative flex h-28 w-28 items-center justify-center rounded-full transition-all",
        "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/40",
        "disabled:cursor-not-allowed",
        isRecording
          ? "bg-accent text-white animate-recording-ring"
          : isProcessing
            ? "bg-accent-soft text-accent"
            : isSpeaking
              ? "bg-fg text-white shadow-lg active:scale-95"
              : "bg-accent text-white animate-pulse-soft shadow-lg hover:shadow-xl active:scale-95",
      )}
    >
      {isRecording || isSpeaking ? (
        <Square className="h-10 w-10" fill="currentColor" />
      ) : isProcessing ? (
        <Loader2 className="h-10 w-10 animate-spin" />
      ) : (
        <Mic className="h-10 w-10" />
      )}
    </button>
  );
}
