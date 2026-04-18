import type { Message } from "@/types";
import { cn } from "@/lib/utils";
import { RobotAvatar } from "@/components/robot-avatar";

export function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="flex w-full justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-br-md border-2 border-fg bg-user-bubble px-4 py-3 text-[15px] font-semibold leading-relaxed text-white shadow-comic-sm">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full items-start gap-2">
      <RobotAvatar className="mt-1" />
      <div className="max-w-[78%] rounded-2xl rounded-bl-md border-2 border-fg bg-bot-soft px-4 py-3 text-[15px] leading-relaxed text-fg shadow-comic-sm">
        {message.content}
      </div>
    </div>
  );
}
