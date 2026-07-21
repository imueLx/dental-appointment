import { z } from "zod";

/**
 * Contract between the site chat widget and the server-side proxy.
 * Keep this stable so n8n workflows can be swapped/extended safely.
 *
 * Conversation context is stored in n8n Simple Memory keyed by `sessionId`.
 * The site only sends the latest user turn — not prior message history.
 */

export const schedulerChatMessageSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, "Message is required")
    .max(2000),
  sessionId: z.string().uuid().optional(),
  // Accepted for backwards compatibility with older clients; ignored by the proxy.
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      })
    )
    .max(200)
    .optional(),
});

export type SchedulerChatMessageInput = z.infer<typeof schedulerChatMessageSchema>;
