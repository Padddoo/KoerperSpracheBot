"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = async (value: string) => {
    if (!value) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: value }),
      });
      if (res.ok) {
        router.replace(next);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Code falsch.");
        setShake(true);
        setCode("");
        setTimeout(() => setShake(false), 500);
        inputRef.current?.focus();
      }
    } catch {
      setError("Verbindung fehlgeschlagen. Nochmal probieren.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={cn(
        "w-full max-w-sm space-y-6 text-center",
        shake && "animate-[shake_0.4s_ease-in-out]",
      )}
    >
      <div>
        <h1 className="font-display text-4xl text-fg">Fred lernt</h1>
        <p className="mt-2 text-sm text-fg/70">
          Gib den Code ein, um loszulegen.
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(code);
        }}
        className="space-y-3"
      >
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          value={code}
          onChange={(e) => {
            const v = e.target.value.replace(/[^0-9]/g, "");
            setCode(v);
            setError(null);
          }}
          placeholder="••••"
          className="w-full rounded-2xl border-2 border-fg/20 bg-white px-4 py-4 text-center text-3xl font-semibold tracking-[0.6em] text-fg outline-none focus:border-accent"
          disabled={loading}
        />
        <Button
          type="submit"
          variant="primary"
          size="lg"
          disabled={!code || loading}
          className="w-full touch-target"
        >
          {loading ? "Prüfe…" : "Los geht's"}
        </Button>
        {error && (
          <div className="rounded-xl bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        )}
      </form>
      <style jsx>{`
        @keyframes shake {
          0%,
          100% {
            transform: translateX(0);
          }
          25% {
            transform: translateX(-8px);
          }
          75% {
            transform: translateX(8px);
          }
        }
      `}</style>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-bg px-4">
      <Suspense fallback={<div className="text-fg/60">Lade…</div>}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
