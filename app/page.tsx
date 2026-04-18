"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Library,
  FileCheck2,
  MessagesSquare,
  Loader2,
} from "lucide-react";
import { UploadZone } from "@/components/upload-zone";
import { MicButton, type MicState } from "@/components/mic-button";
import { ChatView } from "@/components/chat-view";
import { ProgressPill } from "@/components/progress-pill";
import { LibraryPicker } from "@/components/library-picker";
import { SetupCode } from "@/components/setup-code";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  LibraryEntry,
  Message,
  ProgressForMaterial,
  SessionInfo,
  Verdict,
} from "@/types";
import { applyTurn } from "@/lib/progress";
import { AudioQueue } from "@/lib/audio-queue";
import { entryToSession, sessionToEntry } from "@/lib/library";
import {
  clearFamilyCode,
  clearProgressRemote,
  deleteEntryRemote,
  fetchAll,
  loadFamilyCode,
  renameEntryRemote,
  saveFamilyCode,
  saveProgressRemote,
  upsertEntryRemote,
} from "@/lib/sync";

type ProgressMap = Record<string, ProgressForMaterial>;

const CONTINUOUS_KEY = "fred-lernt.continuous.v1";
const MAX_RECORDING_MS = 60_000;

const SILENCE_THRESHOLD = 18;
const SILENCE_DURATION_MS = 1500;
const MIN_RECORDING_MS = 800;

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
  const [familyCode, setFamilyCode] = useState<string | null>(null);
  const [codeChecked, setCodeChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [remoteError, setRemoteError] = useState<string | null>(null);

  const [library, setLibrary] = useState<LibraryEntry[]>([]);
  const [progressAll, setProgressAll] = useState<ProgressMap>({});

  const [session, setSession] = useState<SessionInfo | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [micState, setMicState] = useState<MicState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [currentTopic, setCurrentTopic] = useState<string | null>(null);
  const [showUploadView, setShowUploadView] = useState(false);
  const [continuousMode, setContinuousMode] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioQueueRef = useRef<AudioQueue | null>(null);
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

  // Load code from localStorage + fetch data from server
  useEffect(() => {
    const code = loadFamilyCode();
    setFamilyCode(code);
    setCodeChecked(true);

    try {
      const rawCont = localStorage.getItem(CONTINUOUS_KEY);
      if (rawCont === "1") setContinuousMode(true);
    } catch {}
  }, []);

  const loadRemote = useCallback(async (code: string) => {
    setLoading(true);
    setRemoteError(null);
    try {
      const data = await fetchAll(code);
      setLibrary(data.library);
      setProgressAll(data.progress);
    } catch (err) {
      console.error(err);
      setRemoteError(
        err instanceof Error
          ? err.message
          : "Konnte Bibliothek nicht laden.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (familyCode) loadRemote(familyCode);
  }, [familyCode, loadRemote]);

  const handleCodeSubmit = useCallback((code: string) => {
    saveFamilyCode(code);
    setFamilyCode(code);
  }, []);

  const changeCode = useCallback(() => {
    if (!confirm("Wirklich den Familien-Code ändern? Die Bibliothek wird neu geladen.")) return;
    clearFamilyCode();
    setFamilyCode(null);
    setLibrary([]);
    setProgressAll({});
    setSession(null);
    setMessages([]);
  }, []);

  const teardownAudioContext = useCallback(() => {
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
  }, []);

  const stopEverything = useCallback(() => {
    userCancelledRef.current = true;
    if (audioQueueRef.current) {
      audioQueueRef.current.stop();
      audioQueueRef.current = null;
    }
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.src = "";
      } catch {}
      audioRef.current = null;
    }
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

  const backToLibrary = useCallback(() => {
    stopEverything();
    setSession(null);
    setMessages([]);
    setCurrentTopic(null);
    setError(null);
    setShowUploadView(false);
  }, [stopEverything]);

  const sessionProgress: ProgressForMaterial = session
    ? (progressAll[session.materialHash] ?? {})
    : {};

  const resetProgress = useCallback(async () => {
    if (!session || !familyCode) return;
    try {
      const next = await clearProgressRemote(familyCode, session.materialHash);
      setProgressAll(next);
    } catch (err) {
      console.error(err);
    }
  }, [familyCode, session]);

  const pickFromLibrary = useCallback(
    async (entry: LibraryEntry) => {
      const info = entryToSession(entry);
      setSession(info);
      setMessages([]);
      setCurrentTopic(null);
      setShowUploadView(false);
      // touch lastUsedAt on server
      if (familyCode) {
        try {
          const touched: LibraryEntry = { ...entry, lastUsedAt: Date.now() };
          const nextLib = await upsertEntryRemote(familyCode, touched);
          setLibrary(nextLib);
        } catch (err) {
          console.warn("touch failed", err);
        }
      }
    },
    [familyCode],
  );

  const handleUploaded = useCallback(
    async (info: SessionInfo) => {
      setSession(info);
      setMessages([]);
      setCurrentTopic(null);
      setShowUploadView(false);
      if (familyCode) {
        try {
          const nextLib = await upsertEntryRemote(
            familyCode,
            sessionToEntry(info),
          );
          setLibrary(nextLib);
        } catch (err) {
          console.error("upsert failed", err);
          setError(
            "Material wurde geladen, aber konnte nicht in die Bibliothek gespeichert werden.",
          );
        }
      }
    },
    [familyCode],
  );

  const handleDelete = useCallback(
    async (entry: LibraryEntry) => {
      if (!familyCode) return;
      try {
        const data = await deleteEntryRemote(familyCode, entry.materialHash);
        setLibrary(data.library);
        setProgressAll(data.progress);
      } catch (err) {
        console.error(err);
      }
    },
    [familyCode],
  );

  const handleRename = useCallback(
    async (entry: LibraryEntry, newName: string) => {
      if (!familyCode) return;
      try {
        const nextLib = await renameEntryRemote(
          familyCode,
          entry.materialHash,
          newName,
        );
        setLibrary(nextLib);
      } catch (err) {
        console.error(err);
      }
    },
    [familyCode],
  );

  const handleAudioBlob = useCallback(
    async (blob: Blob, mimeType: string) => {
      if (!session || !familyCode) return;
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
        if (!cRes.ok || !cRes.body) {
          const data = await cRes.json().catch(() => ({}));
          throw new Error(data.error || "Chat fehlgeschlagen");
        }

        // SSE-Reader: satzweise TTS starten, sobald Sätze reinkommen
        setMicState("speaking");
        const queue = new AudioQueue();
        audioQueueRef.current = queue;

        const reader = cRes.body.getReader();
        const decoder = new TextDecoder();
        let sseBuffer = "";
        let fullSpoken = "";
        let finalTopic = "sonstiges";
        let finalVerdict: Verdict = "none";
        let streamError: string | null = null;

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          sseBuffer += decoder.decode(value, { stream: true });
          const events = sseBuffer.split("\n\n");
          sseBuffer = events.pop() ?? "";
          for (const ev of events) {
            const line = ev.trim();
            if (!line.startsWith("data:")) continue;
            const data = line.slice(5).trim();
            if (!data) continue;
            try {
              const obj = JSON.parse(data) as
                | { type: "sentence"; text: string }
                | { type: "final"; full: string; topic: string; verdict: Verdict }
                | { type: "error"; error: string };
              if (obj.type === "sentence") {
                queue.enqueue(obj.text);
              } else if (obj.type === "final") {
                fullSpoken = obj.full || fullSpoken;
                finalTopic = obj.topic || finalTopic;
                finalVerdict = obj.verdict || finalVerdict;
              } else if (obj.type === "error") {
                streamError = obj.error;
              }
            } catch {
              // skip malformed event
            }
          }
        }

        if (streamError) throw new Error(streamError);

        // Fortschritt aktualisieren
        const currentForMat = progressAll[session.materialHash] ?? {};
        const nextForMat = applyTurn(currentForMat, finalTopic, finalVerdict);
        setProgressAll({
          ...progressAll,
          [session.materialHash]: nextForMat,
        });
        setCurrentTopic(finalTopic);
        saveProgressRemote(familyCode, session.materialHash, nextForMat).catch(
          (err) => console.warn("progress sync failed", err),
        );

        setMessages([
          ...nextHistory,
          {
            role: "assistant",
            content: fullSpoken,
            meta: { topic: finalTopic, verdict: finalVerdict },
          },
        ]);

        // Warten, bis alle Sätze abgespielt sind
        await queue.waitForComplete();
        audioQueueRef.current = null;
        setMicState("idle");

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
        audioQueueRef.current?.stop();
        audioQueueRef.current = null;
        setError(
          err instanceof Error
            ? err.message
            : "Etwas ist schiefgegangen. Versuch's nochmal.",
        );
        setMicState("idle");
      }
    },
    [familyCode, messages, progressAll, session],
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
    if (recorder && recorder.state === "recording") recorder.stop();
  }, []);

  const cancelRecording = useCallback(() => {
    userCancelledRef.current = true;
    const recorder = recorderRef.current;
    if (recorder && recorder.state === "recording") recorder.stop();
  }, []);

  const onMicClick = useCallback(() => {
    if (micState === "idle") startRecording();
    else if (micState === "recording") stopRecording();
    else if (micState === "speaking") stopEverything();
  }, [micState, startRecording, stopRecording, stopEverything]);

  const toggleContinuous = useCallback(() => {
    setContinuousMode((v) => {
      const next = !v;
      if (!next) stopEverything();
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

  // --- Views ---

  if (!codeChecked) {
    return <FullscreenSpinner />;
  }

  if (!familyCode) {
    return <SetupCode onSubmit={handleCodeSubmit} />;
  }

  if (loading && library.length === 0 && !session) {
    return <FullscreenSpinner />;
  }

  if (remoteError && !session && library.length === 0) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg px-4">
        <div className="w-full max-w-md rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="font-semibold text-red-900">
            Verbindung zum Server klappt gerade nicht.
          </p>
          <p className="mt-2 text-sm text-red-800">{remoteError}</p>
          <div className="mt-4 flex flex-col gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() => familyCode && loadRemote(familyCode)}
            >
              Nochmal versuchen
            </Button>
            <button
              type="button"
              onClick={changeCode}
              className="text-xs text-fg/60 underline underline-offset-2"
            >
              Familien-Code ändern
            </button>
          </div>
        </div>
      </main>
    );
  }

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
          progress={sessionProgress}
          onReset={resetProgress}
        />

        <div className="flex-1 overflow-y-auto px-4 pb-44 pt-2">
          <div className="mx-auto w-full max-w-xl">
            <ChatView
              messages={messages}
              hint={`Tippe den Mikrofon-Knopf und leg los. Du darfst Fred auch was fragen — z.B. „Kannst Du mir das erklären?" — oder das Thema wechseln mit „Lass uns ${session.topics[0] ?? "dieses Thema"} üben."`}
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
          <UploadZone onUploaded={handleUploaded} />
          {library.length === 0 && (
            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={changeCode}
                className="text-xs text-fg/50 underline underline-offset-2"
              >
                Familien-Code ändern ({familyCode})
              </button>
            </div>
          )}
        </div>
      </main>
    );
  }

  return (
    <LibraryPicker
      library={library}
      progress={progressAll}
      onSelect={pickFromLibrary}
      onNewUpload={() => setShowUploadView(true)}
      onDelete={handleDelete}
      onRename={handleRename}
      onChangeCode={changeCode}
    />
  );
}

function FullscreenSpinner() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg">
      <Loader2 className="h-8 w-8 animate-spin text-accent" />
    </main>
  );
}
