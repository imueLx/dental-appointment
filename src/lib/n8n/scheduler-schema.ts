import { z } from "zod";

/**
 * Contract between the site chat widget and the server-side proxy.
 * Keep this stable so n8n workflows can be swapped/extended safely.
 */
const historyItemSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});

/** Max turns forwarded to n8n (keeps payload small). */
export const SCHEDULER_HISTORY_LIMIT = 50;

export const schedulerChatMessageSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, "Message is required")
    .max(2000),
  sessionId: z.string().uuid().optional(),
  // Accept longer client threads; keep only the most recent turns for n8n.
  history: z
    .array(historyItemSchema)
    .max(200)
    .optional()
    .transform((history) => history?.slice(-SCHEDULER_HISTORY_LIMIT)),
});

export type SchedulerChatMessageInput = z.infer<typeof schedulerChatMessageSchema>;

export type SchedulerChatHistoryMessage = NonNullable<
  SchedulerChatMessageInput["history"]
>[number];

