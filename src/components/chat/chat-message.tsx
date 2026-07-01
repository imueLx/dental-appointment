"use client";

import { Bot } from "lucide-react";
import { cn } from "@/lib/utils";

export type ChatRole = "user" | "assistant";

export interface ChatMessageData {
  id: string;
  role: ChatRole;
  content: string;
}

interface ChatMessageProps {
  message: ChatMessageData;
  showAvatar?: boolean;
}

export function ChatMessage({ message, showAvatar = true }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn(
        "flex w-full gap-2",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      {!isUser && showAvatar && (
        <div
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
          aria-hidden
        >
          <Bot className="size-4" strokeWidth={1.75} />
        </div>
      )}

      <div
        className={cn(
          "max-w-[min(85%,16rem)] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed sm:max-w-[80%]",
          isUser
            ? "rounded-br-md bg-primary text-primary-foreground"
            : "rounded-bl-md border bg-muted/60 text-foreground"
        )}
      >
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
      </div>
    </div>
  );
}
