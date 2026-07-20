import { z } from "zod";
import { CLINIC_LOCATIONS, SERVICE_NAMES, getClinicLocationById } from "@/lib/constants";
import { normalizePhMobile } from "@/lib/phone";
import { SLOT_HOURS, hourToTimeString } from "@/lib/slots";

const CLINIC_LOCATION_IDS = CLINIC_LOCATIONS.map((l) => l.id) as [
  string,
  ...string[],
];

export const bookingSchema = z.object({
  appointmentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  startHour: z
    .number()
    .int()
    .refine((h) => (SLOT_HOURS as readonly number[]).includes(h), {
      message: "Invalid time slot",
    }),
  clinicLocationId: z.enum(CLINIC_LOCATION_IDS, {
    message: "Please select a clinic branch",
  }),
  patientName: z.string().min(2, "Name is required"),
  patientEmail: z.union([
    z.literal(""),
    z.string().email("Enter a valid email"),
  ]),
  patientPhone: z
    .string()
    .trim()
    .min(10, "Enter a valid Philippine mobile number")
    .transform((value) => normalizePhMobile(value) ?? "")
    .refine((value) => /^9\d{9}$/.test(value), {
      message: "Use a PH mobile: 09XXXXXXXXX or +63 9XXXXXXXXX",
    }),
  service: z.enum(SERVICE_NAMES as [string, ...string[]], {
    message: "Please select a service",
  }),
  notes: z.string().optional(),
});

export type BookingFormData = z.infer<typeof bookingSchema>;

export const apiBookingSchema = bookingSchema.extend({
  startTime: z.string().optional(),
});

export function bookingToDbRow(data: BookingFormData) {
  const branch = getClinicLocationById(data.clinicLocationId);
  const noteParts = [`Branch: ${branch.calValue}`];
  if (data.notes?.trim()) noteParts.push(data.notes.trim());

  return {
    appointment_date: data.appointmentDate,
    start_time: hourToTimeString(data.startHour),
    patient_name: data.patientName,
    patient_email: data.patientEmail || "",
    patient_phone: data.patientPhone,
    service: data.service,
    notes: noteParts.join("\n"),
    status: "confirmed" as const,
  };
}

export const contactSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Valid email is required"),
  phone: z.string().optional(),
  message: z.string().min(10, "Message must be at least 10 characters"),
});

export type ContactFormData = z.infer<typeof contactSchema>;
