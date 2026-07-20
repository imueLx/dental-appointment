import { z } from "zod";

/**
 * Contract between the site chat widget and the server-side proxy.
 * Keep this stable so n8n workflows can be swapped/extended safely.
 */
const historyItemSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});

/**
 * Max prior turns forwarded to n8n / the LLM.
 * Keep low — long threads burn Groq/Gemini TPM and trigger rate limits.
 * UI can still show more in sessionStorage; only this window is sent.
 */
export const SCHEDULER_HISTORY_LIMIT = 10;

/** Cap each history message so old long replies don't dominate the prompt. */
export const SCHEDULER_HISTORY_CONTENT_MAX = 400;

function trimHistoryForLlm(
  history: z.infer<typeof historyItemSchema>[] | undefined
): z.infer<typeof historyItemSchema>[] | undefined {
  if (!history?.length) return history;
  return history.slice(-SCHEDULER_HISTORY_LIMIT).map((item) => ({
    role: item.role,
    content:
      item.content.length > SCHEDULER_HISTORY_CONTENT_MAX
        ? `${item.content.slice(0, SCHEDULER_HISTORY_CONTENT_MAX)}…`
        : item.content,
  }));
}

export const schedulerChatMessageSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, "Message is required")
    .max(2000),
  sessionId: z.string().uuid().optional(),
  // Accept longer client threads; keep only a short, trimmed window for the LLM.
  history: z
    .array(historyItemSchema)
    .max(200)
    .optional()
    .transform(trimHistoryForLlm),
});

export type SchedulerChatMessageInput = z.infer<typeof schedulerChatMessageSchema>;

export type SchedulerChatHistoryMessage = NonNullable<
  SchedulerChatMessageInput["history"]
>[number];

