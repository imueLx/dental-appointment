import {
  getN8nSchedulerWebhookSecret,
  getN8nSchedulerWebhookUrl,
} from "@/lib/env";
import type { SchedulerChatMessageInput } from "./scheduler-schema";

export class SchedulerClientError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function postSchedulerChatMessage(
  input: SchedulerChatMessageInput
): Promise<{ reply: string }> {
  const webhookUrl = getN8nSchedulerWebhookUrl();
  if (!webhookUrl) {
    throw new SchedulerClientError(
      503,
      "Schedule assistant is not configured yet. Please try again later or use the Book page."
    );
  }

  const webhookSecret = getN8nSchedulerWebhookSecret();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (webhookSecret) {
    headers["X-Webhook-Secret"] = webhookSecret;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        message: input.message,
        sessionId: input.sessionId,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("n8n webhook error:", res.status, text);
      throw new SchedulerClientError(
        502,
        "The schedule assistant is temporarily unavailable."
      );
    }

    const data = (await res.json()) as { reply?: unknown; message?: unknown };
    const replyCandidate = data.reply ?? data.message;
    const reply = typeof replyCandidate === "string" ? replyCandidate.trim() : "";

    if (!reply) {
      throw new SchedulerClientError(502, "No response from schedule assistant.");
    }

    return { reply };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new SchedulerClientError(
        504,
        "The schedule assistant took too long to respond. Please try again."
      );
    }

    console.error("n8n webhook fetch failed:", error);
    throw new SchedulerClientError(
      502,
      "Could not reach the schedule assistant. Please try again."
    );
  } finally {
    clearTimeout(timeout);
  }
}

