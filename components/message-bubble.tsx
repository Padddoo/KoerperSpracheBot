import type { Message } from "@/types";
import { cn } from "@/lib/utils";

export function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  return (
    <div
      className={cn(
        "flex w-full",
        isUser ? "justify-end" : "justify-start",
      )}
    >
      <div
        className={cn(
          "max-w-[82%] rounded-2xl px-4 py-3 text-[15px] leading-relaxed shadow-sm",
          isUser
            ? "bg-user-bubble text-white rounded-br-md"
            : "bg-accent-soft text-fg rounded-bl-md",
        )}
      >
        {message.content}
      </div>
    </div>
  );
}
