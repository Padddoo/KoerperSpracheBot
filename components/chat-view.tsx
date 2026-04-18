"use client";

import { useEffect, useRef } from "react";
import { MessageBubble } from "@/components/message-bubble";
import type { Message } from "@/types";

interface Props {
  messages: Message[];
  hint?: string;
}

export function ChatView({ messages, hint }: Props) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex flex-col gap-3 py-4">
      {messages.length === 0 && hint && (
        <div className="rounded-2xl bg-accent-soft/60 p-4 text-center text-sm text-fg/70">
          {hint}
        </div>
      )}
      {messages.map((m, i) => (
        <MessageBubble key={i} message={m} />
      ))}
      <div ref={endRef} />
    </div>
  );
}
