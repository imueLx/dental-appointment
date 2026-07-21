"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bot,
  CalendarClock,
  CalendarSearch,
  Loader2,
  MessageSquarePlus,
  RotateCcw,
  SendHorizonal,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  ChatMessage,
  type ChatMessageData,
} from "@/components/chat/chat-message";
import { cn } from "@/lib/utils";

const WELCOME_MESSAGE: ChatMessageData = {
  id: "welcome",
  role: "assistant",
  content:
    "Hi! I'm BrightSmile's AI scheduler. I can check available dates and times, book a new visit, or help you reschedule or cancel — all in this chat.\n\nWhat would you like to do today?",
};

const SESSION_ID_KEY = "scheduler-chat-session-id";
const MESSAGES_KEY = "scheduler-chat-messages";
const ACTIVITY_KEY = "scheduler-chat-activity-at";
/** Start a fresh chat after this much idle time (30 minutes). */
const CHAT_IDLE_TTL_MS = 30 * 60 * 1000;

function clearChatStorage() {
  sessionStorage.removeItem(SESSION_ID_KEY);
  sessionStorage.removeItem(MESSAGES_KEY);
  sessionStorage.removeItem(ACTIVITY_KEY);
}

function touchChatActivity() {
  sessionStorage.setItem(ACTIVITY_KEY, String(Date.now()));
}

function isChatExpired(): boolean {
  const raw = sessionStorage.getItem(ACTIVITY_KEY);
  if (!raw) return false;
  const at = Number(raw);
  if (!Number.isFinite(at)) return true;
  return Date.now() - at > CHAT_IDLE_TTL_MS;
}

function loadStoredMessages(): ChatMessageData[] {
  if (typeof window === "undefined") return [WELCOME_MESSAGE];
  try {
    if (isChatExpired()) {
      clearChatStorage();
      return [WELCOME_MESSAGE];
    }
    const raw = sessionStorage.getItem(MESSAGES_KEY);
    if (!raw) return [WELCOME_MESSAGE];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) return [WELCOME_MESSAGE];
    const valid = parsed.filter(
      (m): m is ChatMessageData =>
        !!m &&
        typeof m === "object" &&
        typeof (m as ChatMessageData).id === "string" &&
        typeof (m as ChatMessageData).content === "string" &&
        ((m as ChatMessageData).role === "user" ||
          (m as ChatMessageData).role === "assistant")
    );
    return valid.length > 0 ? valid : [WELCOME_MESSAGE];
  } catch {
    return [WELCOME_MESSAGE];
  }
}

function createFreshSessionId(): string {
  const id = crypto.randomUUID();
  sessionStorage.setItem(SESSION_ID_KEY, id);
  touchChatActivity();
  return id;
}

const QUICK_PROMPTS = [
  {
    label: "Book appointment",
    message: "I'd like to book an appointment",
    icon: CalendarClock,
  },
  {
    label: "Check availability",
    message: "What dates and times are available this week?",
    icon: CalendarSearch,
  },
  {
    label: "Reschedule",
    message: "I need to reschedule my appointment",
    icon: RotateCcw,
  },
  {
    label: "Cancel",
    message: "I want to cancel my appointment",
    icon: XCircle,
  },
] as const;

interface ChatPanelProps {
  className?: string;
  isOpen?: boolean;
}

function createId() {
  return crypto.randomUUID();
}

export function ChatPanel({ className, isOpen = true }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessageData[]>(loadStoredMessages);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const showQuickPrompts =
    messages.length === 1 && messages[0]?.id === "welcome" && !isLoading;

  useEffect(() => {
    if (isChatExpired()) {
      clearChatStorage();
      setMessages([WELCOME_MESSAGE]);
      setSessionId(createFreshSessionId());
      return;
    }
    const stored = sessionStorage.getItem(SESSION_ID_KEY);
    if (stored) {
      setSessionId(stored);
      return;
    }
    setSessionId(createFreshSessionId());
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    if (!isChatExpired()) return;
    clearChatStorage();
    setMessages([WELCOME_MESSAGE]);
    setInput("");
    setSessionId(createFreshSessionId());
  }, [isOpen]);

  useEffect(() => {
    try {
      // Cap stored thread so sessionStorage / reloads stay bounded
      const toStore =
        messages.length > 100 ? messages.slice(-100) : messages;
      sessionStorage.setItem(MESSAGES_KEY, JSON.stringify(toStore));
      if (messages.some((m) => m.id !== "welcome")) {
        touchChatActivity();
      }
    } catch {
      // ignore quota / private mode failures
    }
  }, [messages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, isLoading]);

  useEffect(() => {
    if (isOpen) {
      const timer = window.setTimeout(() => inputRef.current?.focus(), 300);
      return () => window.clearTimeout(timer);
    }
  }, [isOpen]);

  function startNewChat() {
    if (isLoading) return;
    clearChatStorage();
    setMessages([WELCOME_MESSAGE]);
    setInput("");
    setSessionId(createFreshSessionId());
  }

  async function sendMessage(textOverride?: string) {
    const text = (textOverride ?? input).trim();
    if (!text || isLoading) return;

    const userMessage: ChatMessageData = {
      id: createId(),
      role: "user",
      content: text,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      // n8n Simple Memory is keyed on sessionId — send only the new turn.
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          sessionId,
        }),
      });

      const data = (await res.json()) as { reply?: string; error?: string };

      if (!res.ok) {
        throw new Error(data.error ?? "Something went wrong");
      }

      setMessages((prev) => [
        ...prev,
        {
          id: createId(),
          role: "assistant",
          content: data.reply ?? "Done.",
        },
      ]);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not send message";
      toast.error(message);
      setMessages((prev) => [
        ...prev,
        {
          id: createId(),
          role: "assistant",
          content: "Sorry, I couldn't process that. Please try again in a moment.",
        },
      ]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  }

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4"
      >
        {messages.map((message) => (
          <ChatMessage key={message.id} message={message} />
        ))}

        {showQuickPrompts && (
          <div className="space-y-2 pl-10">
            <p className="text-xs font-medium text-muted-foreground">
              Quick actions
            </p>
            <div className="flex flex-wrap gap-2">
              {QUICK_PROMPTS.map(({ label, message, icon: Icon }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => void sendMessage(message)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border bg-background px-3 py-2",
                    "text-xs font-medium text-foreground shadow-sm",
                    "touch-manipulation transition-colors hover:border-primary/30 hover:bg-primary/5 active:scale-[0.98]"
                  )}
                >
                  <Icon className="size-3.5 text-primary" />
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {isLoading && (
          <div className="flex items-center gap-2 pl-10 text-sm text-muted-foreground">
            <div className="flex size-8 items-center justify-center rounded-full bg-primary/10">
              <Bot className="size-4 text-primary" />
            </div>
            <div className="flex items-center gap-2 rounded-2xl rounded-bl-md border bg-muted/60 px-3.5 py-2.5">
              <Loader2 className="size-3.5 animate-spin" />
              <span className="text-xs">Thinking...</span>
            </div>
          </div>
        )}
      </div>

      <div className="shrink-0 border-t bg-background/95 px-4 pt-3 pb-safe backdrop-blur-sm max-sm:pt-4">
        {!showQuickPrompts && (
          <div className="mb-2 flex justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
              disabled={isLoading}
              onClick={startNewChat}
            >
              <MessageSquarePlus className="size-3.5" />
              New chat
            </Button>
          </div>
        )}
        <div className="flex items-end gap-2.5">
          <Textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message..."
            disabled={isLoading}
            rows={1}
            className={cn(
              "min-h-[48px] max-h-32 resize-none rounded-2xl py-3 text-base",
              "touch-manipulation sm:min-h-[44px] sm:text-sm"
            )}
          />
          <Button
            type="button"
            size="icon"
            className="size-12 shrink-0 rounded-full shadow-md shadow-primary/20 touch-manipulation sm:size-11"
            disabled={isLoading || !input.trim()}
            onClick={() => void sendMessage()}
            aria-label="Send message"
          >
            <SendHorizonal className="size-4" />
          </Button>
        </div>
        <p className="mt-2 hidden text-center text-[11px] text-muted-foreground sm:block">
          Press Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
