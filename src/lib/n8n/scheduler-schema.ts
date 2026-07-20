import { z } from "zod";

/**
 * Contract between the site chat widget and the server-side proxy.
 * Keep this stable so n8n workflows can be swapped/extended safely.
 */
export const schedulerChatMessageSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, "Message is required")
    .max(2000),
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

export type SchedulerChatMessageInput = z.infer<typeof schedulerChatMessageSchema>;

export type SchedulerChatHistoryMessage = NonNullable<
  SchedulerChatMessageInput["history"]
>[number];

