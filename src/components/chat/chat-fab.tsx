"use client";

import { Bot, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatFabProps {
  onClick: () => void;
  hidden?: boolean;
  showPulse?: boolean;
  className?: string;
}

export function ChatFab({
  onClick,
  hidden = false,
  showPulse = false,
  className,
}: ChatFabProps) {
  return (
    <div
      className={cn(
        "fixed right-4 z-40 transition-all duration-300",
        "bottom-[max(1rem,env(safe-area-inset-bottom))]",
        hidden && "pointer-events-none scale-0 opacity-0",
        className
      )}
    >
      {showPulse && (
        <span
          aria-hidden
          className="absolute inset-0 animate-ping rounded-full bg-primary/30"
        />
      )}
      <span
        aria-hidden
        className="absolute -inset-1 rounded-full bg-linear-to-br from-primary/20 to-primary/5 blur-sm"
      />

      <button
        type="button"
        aria-label="Open AI schedule assistant"
        onClick={onClick}
        className={cn(
          "relative flex size-[3.75rem] items-center justify-center rounded-full",
          "bg-linear-to-br from-primary via-primary to-primary/90",
          "text-primary-foreground shadow-xl shadow-primary/30",
          "ring-2 ring-primary/20 ring-offset-2 ring-offset-background",
          "transition-transform hover:scale-105 active:scale-95",
          "touch-manipulation sm:size-16"
        )}
      >
        <span className="relative flex size-full items-center justify-center">
          <Bot className="size-7 sm:size-8" strokeWidth={1.75} />
          <span
            className={cn(
              "absolute -top-0.5 -right-0.5 flex size-5 items-center justify-center",
              "rounded-full bg-background text-primary shadow-sm ring-1 ring-primary/20"
            )}
          >
            <Sparkles className="size-2.5" />
          </span>
        </span>
        <span className="sr-only">AI Schedule Assistant</span>
      </button>

      <span
        aria-hidden
        className={cn(
          "absolute -top-1 left-1/2 -translate-x-1/2 -translate-y-full",
          "rounded-full bg-foreground px-2 py-0.5 text-[10px] font-semibold tracking-wide text-background uppercase",
          "shadow-sm"
        )}
      >
        AI
      </span>
    </div>
  );
}
