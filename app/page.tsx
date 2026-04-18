"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw, FileCheck2 } from "lucide-react";
import { UploadZone } from "@/components/upload-zone";
import { MicButton, type MicState } from "@/components/mic-button";
import { ChatView } from "@/components/chat-view";
import { ProgressPill } from "@/components/progress-pill";
import { Button } from "@/components/ui/button";
import type {
  Message,
  ProgressForMaterial,
  SessionInfo,
  Verdict,
} from "@/types";
import {
  clearProgress,
  loadProgress,
  recordTurn,
} from "@/lib/progress";

const STORAGE_KEY = "fred-lernt.session.v1";
const MAX_RECORDING_MS = 60_000;

interface PersistedState {
  session: SessionInfo;
  messages: Message[];
}

function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/mp4;codecs=mp4a.40.2",
    "audio/ogg;codecs=opus",
  ];
  for (const t of candidates) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return "";
}

export default function Home() {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [micState, setMicState] = useState<MicState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<ProgressForMaterial>({});
  const [currentTopic, setCurrentTopic] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const stopTimerRef = useRef<number | null>(null);

  // Restore session from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as PersistedState;
        if (parsed.session?.sessionId && parsed.session?.materialHash) {
          setSession(parsed.session);
          setMessages(parsed.messages ?? []);
          setProgress(loadProgress(parsed.session.materialHash));
          // Setze das zuletzt aktive Thema, falls vorhanden
          const lastAssistant = [...(parsed.messages ?? [])]
            .reverse()
            .find((m) => m.role === "assistant" && m.meta?.topic);
          setCurrentTopic(lastAssistant?.meta?.topic ?? null);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (session) {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ session, messages } satisfies PersistedState),
      );
    }
  }, [session, messages]);

  const resetSession = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setSession(null);
    setMessages([]);
    setProgress({});
    setCurrentTopic(null);
    setError(null);
  }, []);

  const resetProgress = useCallback(() => {
    if (!session) return;
    clearProgress(session.materialHash);
    setProgress({});
  }, [session]);

  const speak = useCallback(async (text: string) => {
    try {
      setMicState("speaking");
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error("TTS fehlgeschlagen");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        URL.revokeObjectURL(url);
        setMicState("idle");
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        setMicState("idle");
      };
      await audio.play();
    } catch (err) {
      console.error(err);
      setMicState("idle");
    }
  }, []);

  const handleAudioBlob = useCallback(
    async (blob: Blob, mimeType: string) => {
      if (!session) return;
      if (blob.size < 2000) {
        setMicState("idle");
        setError("Das war sehr kurz. Tippe nochmal und sprich länger.");
        return;
      }
      setMicState("processing");
      setError(null);

      try {
        const ext = mimeType.includes("mp4")
          ? "m4a"
          : mimeType.includes("ogg")
            ? "ogg"
            : "webm";
        const fd = new FormData();
        fd.append("audio", blob, `aufnahme.${ext}`);

        const tRes = await fetch("/api/transcribe", {
          method: "POST",
          body: fd,
        });
        if (!tRes.ok) throw new Error("Transcribe fehlgeschlagen");
        const { text } = (await tRes.json()) as { text: string };
        const userText = (text || "").trim();
        if (!userText) {
          setMicState("idle");
          setError("Ich habe nichts gehört. Tippe nochmal und sprich laut.");
          return;
        }

        const nextHistory: Message[] = [
          ...messages,
          { role: "user", content: userText },
        ];
        setMessages(nextHistory);

        const cRes = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            material: session.material,
            topics: session.topics,
            userMessage: userText,
            history: messages,
          }),
        });
        if (!cRes.ok) {
          const data = await cRes.json().catch(() => ({}));
          throw new Error(data.error || "Chat fehlgeschlagen");
        }
        const {
          assistantMessage,
          topic,
          verdict,
        } = (await cRes.json()) as {
          assistantMessage: string;
          topic: string;
          verdict: Verdict;
        };

        // Fortschritt aktualisieren
        const updated = recordTurn(session.materialHash, topic, verdict);
        setProgress(updated);
        setCurrentTopic(topic);

        setMessages([
          ...nextHistory,
          {
            role: "assistant",
            content: assistantMessage,
            meta: { topic, verdict },
          },
        ]);

        await speak(assistantMessage);
      } catch (err) {
        console.error(err);
        setError(
          err instanceof Error
            ? err.message
            : "Etwas ist schiefgegangen. Versuch's nochmal.",
        );
        setMicState("idle");
      }
    },
    [messages, session, speak],
  );

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined,
      );
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const effectiveMime = recorder.mimeType || mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: effectiveMime });
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        if (stopTimerRef.current) {
          window.clearTimeout(stopTimerRef.current);
          stopTimerRef.current = null;
        }
        handleAudioBlob(blob, effectiveMime);
      };
      recorder.start();
      recorderRef.current = recorder;
      setMicState("recording");

      stopTimerRef.current = window.setTimeout(() => {
        if (recorder.state === "recording") recorder.stop();
      }, MAX_RECORDING_MS);
    } catch (err) {
      console.error(err);
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        setError(
          "Ich brauche Dein Mikrofon. Bitte erlaube den Zugriff in den Browser-Einstellungen.",
        );
      } else {
        setError("Mikrofon konnte nicht gestartet werden.");
      }
      setMicState("idle");
    }
  }, [handleAudioBlob]);

  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state === "recording") {
      recorder.stop();
    }
  }, []);

  const onMicClick = useCallback(() => {
    if (micState === "idle") startRecording();
    else if (micState === "recording") stopRecording();
  }, [micState, startRecording, stopRecording]);

  if (!session) {
    return (
      <main className="min-h-screen bg-bg px-4 py-10">
        <UploadZone
          onUploaded={(info) => {
            setSession(info);
            setMessages([]);
            setProgress(loadProgress(info.materialHash));
            setCurrentTopic(null);
          }}
        />
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col bg-bg">
      <header className="flex items-center justify-between border-b border-fg/10 bg-white/60 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2 text-sm text-fg/70">
          <FileCheck2 className="h-4 w-4 text-accent" />
          <span>
            Material: {session.filenames.length}{" "}
            {session.filenames.length === 1 ? "Datei" : "Dateien"}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={resetSession}
          className="text-fg/70"
        >
          <RefreshCw className="h-4 w-4" />
          Neues Material
        </Button>
      </header>

      <ProgressPill
        currentTopic={currentTopic}
        topics={session.topics}
        progress={progress}
        onReset={resetProgress}
      />

      <div className="flex-1 overflow-y-auto px-4 pb-40 pt-2">
        <div className="mx-auto w-full max-w-xl">
          <ChatView
            messages={messages}
            hint={`Tippe den Mikrofon-Knopf und leg los. Du kannst auch sagen: „Lass uns ${session.topics[0] ?? "dieses Thema"} üben."`}
          />
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-fg/10 bg-bg/95 backdrop-blur">
        <div className="mx-auto flex max-w-xl flex-col items-center gap-3 px-4 py-6">
          {error && (
            <div className="w-full rounded-xl bg-red-50 p-3 text-center text-sm text-red-800">
              {error}
            </div>
          )}
          <MicButton state={micState} onClick={onMicClick} />
          <p className="text-xs text-fg/60">
            {micState === "idle" && "Tippen zum Sprechen"}
            {micState === "recording" && "Ich höre zu — nochmal tippen zum Stoppen"}
            {micState === "processing" && "Einen Moment…"}
            {micState === "speaking" && "Fred hört zu…"}
          </p>
        </div>
      </div>
    </main>
  );
}
