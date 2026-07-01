import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const chatMessageSchema = z.object({
  message: z.string().trim().min(1, "Message is required").max(2000),
  sessionId: z.string().uuid().optional(),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      })
    )
    .max(50)
    .optional(),
});

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
  const webhookUrl = process.env.N8N_SCHEDULER_WEBHOOK_URL;
  if (!webhookUrl) {
    return NextResponse.json(
      {
        error:
          "Schedule assistant is not configured yet. Please try again later or use the Book page.",
      },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = chatMessageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid message" },
      { status: 400 }
    );
  }

  const { message, sessionId, history } = parsed.data;
  const rateKey = sessionId ?? request.headers.get("x-forwarded-for") ?? "anonymous";

  if (!checkRateLimit(rateKey)) {
    return NextResponse.json(
      { error: "Too many messages. Please wait a moment and try again." },
      { status: 429 }
    );
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const webhookSecret = process.env.N8N_SCHEDULER_WEBHOOK_SECRET;
  if (webhookSecret) {
    headers["X-Webhook-Secret"] = webhookSecret;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({ message, sessionId, history }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("n8n webhook error:", res.status, text);
      return NextResponse.json(
        { error: "The schedule assistant is temporarily unavailable." },
        { status: 502 }
      );
    }

    const data = (await res.json()) as { reply?: string; message?: string };
    const reply = data.reply ?? data.message;

    if (!reply?.trim()) {
      return NextResponse.json(
        { error: "No response from schedule assistant." },
        { status: 502 }
      );
    }

    return NextResponse.json({ reply: reply.trim() });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return NextResponse.json(
        { error: "The schedule assistant took too long to respond. Please try again." },
        { status: 504 }
      );
    }
    console.error("n8n webhook fetch failed:", error);
    return NextResponse.json(
      { error: "Could not reach the schedule assistant. Please try again." },
      { status: 502 }
    );
  } finally {
    clearTimeout(timeout);
  }
}
