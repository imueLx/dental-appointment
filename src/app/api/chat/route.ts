import { NextRequest, NextResponse } from "next/server";
import {
  schedulerChatMessageSchema,
  type SchedulerChatMessageInput,
} from "@/lib/n8n/scheduler-schema";
import {
  postSchedulerChatMessage,
  SchedulerClientError,
} from "@/lib/n8n/scheduler-client";

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 20;

function checkRateLimit(sessionId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(sessionId);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(sessionId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count += 1;
  return true;
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = schedulerChatMessageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid message" },
      { status: 400 }
    );
  }

  const { message, sessionId } = parsed.data as SchedulerChatMessageInput;
  const rateKey = sessionId ?? request.headers.get("x-forwarded-for") ?? "anonymous";

  if (!checkRateLimit(rateKey)) {
    return NextResponse.json(
      { error: "Too many messages. Please wait a moment and try again." },
      { status: 429 }
    );
  }

  try {
    // Context lives in n8n Simple Memory (keyed by sessionId) — do not forward history.
    const { reply } = await postSchedulerChatMessage({
      message,
      sessionId,
    });
    return NextResponse.json({ reply });
  } catch (error) {
    if (error instanceof SchedulerClientError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("n8n webhook call failed:", error);
    return NextResponse.json(
      { error: "Could not reach the schedule assistant. Please try again." },
      { status: 502 }
    );
  }
}
