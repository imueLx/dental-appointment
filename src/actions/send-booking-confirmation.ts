"use server";

import { z } from "zod";
import {
  sendBookingConfirmationEmail,
  type BookingConfirmationPayload,
} from "@/lib/email";
import { SLOT_HOURS } from "@/lib/slots";

const schema = z.object({
  patientEmail: z.union([z.literal(""), z.string().email()]),
  patientName: z.string().max(120).optional(),
  appointmentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startHour: z
    .number()
    .int()
    .refine((h) => (SLOT_HOURS as readonly number[]).includes(h)),
});

export type SendBookingConfirmationResult =
  | { sent: true }
  | { sent: false; skipped: true }
  | { sent: false; skipped: false; error: string };

export async function sendBookingConfirmation(
  data: BookingConfirmationPayload
): Promise<SendBookingConfirmationResult> {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    return {
      sent: false,
      skipped: false,
      error: "Invalid confirmation details",
    };
  }

  if (!parsed.data.patientEmail) {
    return { sent: false, skipped: true };
  }

  const result = await sendBookingConfirmationEmail(parsed.data);
  if (result.sent) {
    return { sent: true };
  }

  return {
    sent: false,
    skipped: false,
    error: result.error ?? "Failed to send confirmation email",
  };
}
