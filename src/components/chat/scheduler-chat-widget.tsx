"use client";

import { useEffect, useState } from "react";
import { Bot, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ChatFab } from "@/components/chat/chat-fab";
import {
  ChatIntroTeaser,
  dismissTeaser,
  wasTeaserDismissed,
} from "@/components/chat/chat-intro-teaser";
import { ChatPanel } from "@/components/chat/chat-panel";
import { cn } from "@/lib/utils";

export function SchedulerChatWidget() {
  const [open, setOpen] = useState(false);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showTeaser, setShowTeaser] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setBookingOpen(document.body.dataset.bookingOpen === "true");
    });
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["data-booking-open"],
    });
    setBookingOpen(document.body.dataset.bookingOpen === "true");
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (wasTeaserDismissed() || open) return;

    const timer = window.setTimeout(() => {
      if (!wasTeaserDismissed()) setShowTeaser(true);
    }, 2500);

    return () => window.clearTimeout(timer);
  }, [open]);

  function handleOpenChat() {
    dismissTeaser();
    setShowTeaser(false);
    setOpen(true);
  }

  function handleDismissTeaser() {
    dismissTeaser();
    setShowTeaser(false);
  }

  const hidden = bookingOpen;

  return (
    <>
      <ChatIntroTeaser
        visible={showTeaser && !hidden && !open}
        onDismiss={handleDismissTeaser}
        onOpenChat={handleOpenChat}
      />

      <ChatFab
        onClick={handleOpenChat}
        hidden={hidden}
        showPulse={showTeaser && !open}
      />

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side={isMobile ? "bottom" : "right"}
          className={cn(
            "flex w-full flex-col gap-0 p-0",
            isMobile
              ? "h-[min(92dvh,720px)] rounded-t-3xl border-t"
              : "sm:max-w-md"
          )}
        >
          {isMobile && (
            <div className="flex shrink-0 justify-center pt-3 pb-1">
              <div className="h-1 w-10 rounded-full bg-muted-foreground/25" />
            </div>
          )}

          <SheetHeader
            className={cn(
              "shrink-0 border-b bg-linear-to-br from-primary/10 via-background to-background text-left",
              isMobile ? "px-4 pb-4 pt-1" : "px-4 py-4 pt-safe"
            )}
          >
            <div className="flex items-start gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md shadow-primary/25">
                <Bot className="size-6" strokeWidth={1.75} />
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <SheetTitle className="text-base font-semibold">
                    AI Schedule Assistant
                  </SheetTitle>
                  <Badge
                    variant="secondary"
                    className="gap-1 rounded-full px-2 py-0 text-[10px] font-medium"
                  >
                    <Sparkles className="size-2.5 text-primary" />
                    Powered by AI
                  </Badge>
                </div>
                <SheetDescription className="text-xs leading-relaxed sm:text-sm">
                  Book, check availability, reschedule, or cancel — all in one
                  conversation.
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <ChatPanel isOpen={open} />
        </SheetContent>
      </Sheet>
    </>
  );
}
