"use client";

import { CalendarClock, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const TEASER_STORAGE_KEY = "scheduler-chat-teaser-dismissed";

interface ChatIntroTeaserProps {
  visible: boolean;
  onDismiss: () => void;
  onOpenChat: () => void;
  className?: string;
}

export function ChatIntroTeaser({
  visible,
  onDismiss,
  onOpenChat,
  className,
}: ChatIntroTeaserProps) {
  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="AI scheduler introduction"
      className={cn(
        "fixed z-40 w-[min(calc(100vw-2rem),18rem)] animate-in-up",
        "bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] right-4",
        "max-sm:bottom-[calc(5.25rem+env(safe-area-inset-bottom,0px))]",
        className
      )}
    >
      <div className="relative rounded-2xl border bg-popover p-4 shadow-xl shadow-primary/10 ring-1 ring-foreground/5">
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label="Dismiss"
          onClick={onDismiss}
          className="absolute top-2 right-2 size-7 text-muted-foreground hover:text-foreground"
        >
          <X className="size-3.5" />
        </Button>

        <div className="flex items-start gap-3 pr-6">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Sparkles className="size-5" />
          </div>
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-semibold leading-snug text-foreground">
              Try our AI Scheduler
            </p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Book, reschedule, or cancel appointments in seconds — just ask.
            </p>
          </div>
        </div>

        <Button
          type="button"
          size="sm"
          className="mt-3 h-9 w-full gap-1.5 rounded-xl shadow-md shadow-primary/15"
          onClick={onOpenChat}
        >
          <CalendarClock className="size-3.5" />
          Chat now
        </Button>

        {/* Pointer toward FAB */}
        <div
          aria-hidden
          className="absolute -bottom-2 right-6 size-4 rotate-45 border-r border-b bg-popover"
        />
      </div>
    </div>
  );
}

export function wasTeaserDismissed(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(TEASER_STORAGE_KEY) === "true";
}

export function dismissTeaser(): void {
  localStorage.setItem(TEASER_STORAGE_KEY, "true");
}
