"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Library, FileCheck2, MessagesSquare } from "lucide-react";
import { UploadZone } from "@/components/upload-zone";
import { MicButton, type MicState } from "@/components/mic-button";
import { ChatView } from "@/components/chat-view";
import { ProgressPill } from "@/components/progress-pill";
import { LibraryPicker } from "@/components/library-picker";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  LibraryEntry,
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
import {
  entryToSession,
  loadLibrary,
  sessionToEntry,
  touchEntry,
  upsertEntry,
} from "@/lib/library";

const STORAGE_KEY = "fred-lernt.session.v1";
const CONTINUOUS_KEY = "fred-lernt.continuous.v1";
const MAX_RECORDING_MS = 60_000;

// Silence detection tuning
const SILENCE_THRESHOLD = 18; // 0..255 avg frequency-byte
const SILENCE_DURATION_MS = 1500;
const MIN_RECORDING_MS = 800;

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
  const [library, setLibrary] = useState<LibraryEntry[]>([]);
  const [showUploadView, setShowUploadView] = useState(false);
  const [continuousMode, setContinuousMode] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const stopTimerRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const continuousModeRef = useRef(false);
  const userCancelledRef = useRef(false);
  const startRecordingRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    continuousModeRef.current = continuousMode;
    try {
      localStorage.setItem(CONTINUOUS_KEY, continuousMode ? "1" : "0");
    } catch {}
  }, [continuousMode]);

  useEffect(() => {
    const lib = loadLibrary();
    setLibrary(lib);

    try {
      const rawCont = localStorage.getItem(CONTINUOUS_KEY);
      if (rawCont === "1") setContinuousMode(true);
    } catch {}

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as PersistedState;
        if (parsed.session?.sessionId && parsed.session?.materialHash) {
          setSession(parsed.session);
          setMessages(parsed.messages ?? []);
          setProgress(loadProgress(parsed.session.materialHash));
          const lastAssistant = [...(parsed.messages ?? [])]
            .reverse()
            .find((m) => m.role === "assistant" && m.meta?.topic);
          setCurrentTopic(lastAssistant?.meta?.topic ?? null);

          if (!lib.some((e) => e.materialHash === parsed.session.materialHash)) {
            setLibrary(upsertEntry(sessionToEntry(parsed.session)));
          }
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (session) {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ session, messages } satisfies PersistedState),
      );
    }
  }, [session, messages]);

  const teardownAudioContext = useCallback(() => {
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
  }, []);

  const backToLibrary = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    teardownAudioContext();
    setSession(null);
    setMessages([]);
    setProgress({});
    setCurrentTopic(null);
    setError(null);
    setShowUploadView(false);
    setMicState("idle");
  }, [teardownAudioContext]);

  const resetProgress = useCallback(() => {
    if (!session) return;
    clearProgress(session.materialHash);
    setProgress({});
  }, [session]);

  const pickFromLibrary = useCallback((entry: LibraryEntry) => {
    const info = entryToSession(entry);
    setSession(info);
    setMessages([]);
    setProgress(loadProgress(entry.materialHash));
    setCurrentTopic(null);
    setLibrary(touchEntry(entry.materialHash));
    setShowUploadView(false);
  }, []);

  // Progressive TTS: direktes audio.src auf den streamenden GET-Endpoint.
  // Browser fängt an zu spielen, sobald genug Bytes da sind — spart 1–2s.
  const speak = useCallback((text: string): Promise<void> => {
    return new Promise((resolve) => {
      try {
        setMicState("speaking");
        const url = `/api/tts?text=${encodeURIComponent(text)}`;
        const audio = new Audio(url);
        audio.preload = "auto";
        audioRef.current = audio;
        const done = () => {
          audioRef.current = null;
          resolve();
        };
        audio.onended = done;
        audio.onerror = () => {
          console.warn("TTS Audio-Fehler");
          done();
        };
        audio.play().catch((err) => {
          console.warn("Audio konnte nicht starten:", err);
          done();
        });
      } catch (err) {
        console.error(err);
        resolve();
      }
    });
  }, []);

  const handleAudioBlob = useCallback(
    async (blob: Blob, mimeType: string) => {
      if (!session) return;
      if (blob.size < 2000) {
        setMicState("idle");
        if (!continuousModeRef.current) {
          setError("Das war sehr kurz. Tippe nochmal und sprich länger.");
        }
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
          if (!continuousModeRef.current) {
            setError("Ich habe nichts gehört. Tippe nochmal und sprich laut.");
          }
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
        setMicState("idle");

        // Dialog-Modus: nach TTS automatisch wieder zuhören
        if (continuousModeRef.current && !userCancelledRef.current) {
          setTimeout(() => {
            if (continuousModeRef.current && !userCancelledRef.current) {
              startRecordingRef.current?.();
            }
          }, 350);
        }
        userCancelledRef.current = false;
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
      userCancelledRef.current = false;
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
        teardownAudioContext();
        if (stopTimerRef.current) {
          window.clearTimeout(stopTimerRef.current);
          stopTimerRef.current = null;
        }
        if (userCancelledRef.current) {
          setMicState("idle");
          return;
        }
        handleAudioBlob(blob, effectiveMime);
      };
      recorder.start();
      recorderRef.current = recorder;
      setMicState("recording");

      stopTimerRef.current = window.setTimeout(() => {
        if (recorder.state === "recording") recorder.stop();
      }, MAX_RECORDING_MS);

      // Silence detection im Dialog-Modus
      if (continuousModeRef.current) {
        try {
          const AudioCtx =
            window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext })
              .webkitAudioContext;
          const audioContext = new AudioCtx();
          audioContextRef.current = audioContext;
          const source = audioContext.createMediaStreamSource(stream);
          const analyser = audioContext.createAnalyser();
          analyser.fftSize = 512;
          source.connect(analyser);
          const buffer = new Uint8Array(analyser.frequencyBinCount);
          const recordingStart = performance.now();
          let hasHeardSpeech = false;
          let silenceStart = 0;

          const tick = () => {
            if (recorder.state !== "recording") return;
            analyser.getByteFrequencyData(buffer);
            let sum = 0;
            for (let i = 0; i < buffer.length; i++) sum += buffer[i];
            const avg = sum / buffer.length;

            if (avg > SILENCE_THRESHOLD) {
              hasHeardSpeech = true;
              silenceStart = 0;
            } else if (
              hasHeardSpeech &&
              performance.now() - recordingStart > MIN_RECORDING_MS
            ) {
              if (!silenceStart) silenceStart = performance.now();
              else if (
                performance.now() - silenceStart >
                SILENCE_DURATION_MS
              ) {
                recorder.stop();
                return;
              }
            }
            requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        } catch (e) {
          console.warn("Silence detection nicht verfügbar:", e);
        }
      }
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
  }, [handleAudioBlob, teardownAudioContext]);

  useEffect(() => {
    startRecordingRef.current = startRecording;
  }, [startRecording]);

  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state === "recording") {
      recorder.stop();
    }
  }, []);

  const cancelRecording = useCallback(() => {
    userCancelledRef.current = true;
    const recorder = recorderRef.current;
    if (recorder && recorder.state === "recording") {
      recorder.stop();
    }
  }, []);

  const stopEverything = useCallback(() => {
    userCancelledRef.current = true;
    // Audio stoppen
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.src = "";
      } catch {}
      audioRef.current = null;
    }
    // Recording stoppen
    const recorder = recorderRef.current;
    if (recorder && recorder.state === "recording") {
      try {
        recorder.stop();
      } catch {}
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    teardownAudioContext();
    if (stopTimerRef.current) {
      window.clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
    setMicState("idle");
  }, [teardownAudioContext]);

  const onMicClick = useCallback(() => {
    if (micState === "idle") startRecording();
    else if (micState === "recording") stopRecording();
    else if (micState === "speaking") stopEverything();
  }, [micState, startRecording, stopRecording, stopEverything]);

  const toggleContinuous = useCallback(() => {
    setContinuousMode((v) => {
      const next = !v;
      if (!next) {
        // Beim Ausschalten: alles sofort stoppen
        stopEverything();
      }
      return next;
    });
  }, [stopEverything]);

  useEffect(
    () => () => {
      teardownAudioContext();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    },
    [teardownAudioContext],
  );

  // --- View selection ---

  if (session) {
    return (
      <main className="flex min-h-screen flex-col bg-bg">
        <header className="flex items-center justify-between border-b border-fg/10 bg-white/60 px-4 py-3 backdrop-blur">
          <div className="flex items-center gap-2 text-sm text-fg/70">
            <FileCheck2 className="h-4 w-4 text-accent" />
            <span className="truncate">
              Material: {session.filenames.length}{" "}
              {session.filenames.length === 1 ? "Datei" : "Dateien"}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={backToLibrary}
            className="text-fg/70"
          >
            <Library className="h-4 w-4" />
            Bibliothek
          </Button>
        </header>

        <ProgressPill
          currentTopic={currentTopic}
          topics={session.topics}
          progress={progress}
          onReset={resetProgress}
        />

        <div className="flex-1 overflow-y-auto px-4 pb-44 pt-2">
          <div className="mx-auto w-full max-w-xl">
            <ChatView
              messages={messages}
              hint={`Tippe den Mikrofon-Knopf und leg los. Du kannst auch sagen: „Lass uns ${session.topics[0] ?? "dieses Thema"} üben."`}
            />
          </div>
        </div>

        <div className="fixed inset-x-0 bottom-0 border-t border-fg/10 bg-bg/95 backdrop-blur">
          <div className="mx-auto flex max-w-xl flex-col items-center gap-2 px-4 pb-6 pt-3">
            <button
              type="button"
              onClick={toggleContinuous}
              aria-pressed={continuousMode}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
                continuousMode
                  ? "border-accent bg-accent text-white"
                  : "border-fg/20 bg-white/70 text-fg/70 hover:bg-accent-soft",
              )}
            >
              <MessagesSquare className="h-3.5 w-3.5" />
              Dialog-Modus {continuousMode ? "an" : "aus"}
            </button>
            {error && (
              <div className="w-full rounded-xl bg-red-50 p-3 text-center text-sm text-red-800">
                {error}
              </div>
            )}
            <MicButton state={micState} onClick={onMicClick} />
            <p className="text-xs text-fg/60">
              {micState === "idle" &&
                (continuousMode
                  ? "Tippen zum Starten — ich höre dann automatisch zu"
                  : "Tippen zum Sprechen")}
              {micState === "recording" &&
                (continuousMode
                  ? "Ich höre zu — stoppt automatisch, wenn Du fertig bist"
                  : "Ich höre zu — nochmal tippen zum Stoppen")}
              {micState === "processing" && "Einen Moment…"}
              {micState === "speaking" && "Tippen zum Stoppen"}
            </p>
            {micState === "recording" && continuousMode && (
              <button
                type="button"
                onClick={cancelRecording}
                className="text-xs text-fg/50 underline underline-offset-2"
              >
                Abbrechen
              </button>
            )}
          </div>
        </div>
      </main>
    );
  }

  if (showUploadView || library.length === 0) {
    return (
      <main className="min-h-screen bg-bg px-4 py-8">
        <div className="mx-auto w-full max-w-xl">
          {library.length > 0 && (
            <button
              type="button"
              onClick={() => setShowUploadView(false)}
              className="mb-4 inline-flex items-center gap-1.5 text-sm text-fg/60 hover:text-fg"
            >
              <ArrowLeft className="h-4 w-4" />
              Zurück zur Bibliothek
            </button>
          )}
          <UploadZone
            onUploaded={(info) => {
              setSession(info);
              setMessages([]);
              setProgress(loadProgress(info.materialHash));
              setCurrentTopic(null);
              setLibrary(upsertEntry(sessionToEntry(info)));
              setShowUploadView(false);
            }}
          />
        </div>
      </main>
    );
  }

  return (
    <LibraryPicker
      library={library}
      onSelect={pickFromLibrary}
      onNewUpload={() => setShowUploadView(true)}
      onLibraryChange={setLibrary}
    />
  );
}
