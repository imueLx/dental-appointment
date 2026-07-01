"use server";

import { revalidatePath } from "next/cache";
import {
  buildBookingStartIso,
  createCalBooking,
  getCalApiKey,
  getClinicTimeZone,
  parseCalLink,
} from "@/lib/cal";
import { CLINIC, getClinicLocationById } from "@/lib/constants";
import { getCalLink, getSupabaseServiceKey, getSupabaseUrl } from "@/lib/env";
import { createServiceClient } from "@/lib/supabase/admin";
import {
  bookingSchema,
  bookingToDbRow,
  type BookingFormData,
} from "@/lib/validators";

export type BookAppointmentResult =
  | { success: true; id: string; calSynced: boolean }
  | { success: false; error: string };

function attendeeEmail(data: BookingFormData): string {
  if (data.patientEmail?.trim()) return data.patientEmail.trim();
  const digits = data.patientPhone.replace(/\D/g, "");
  return `booking+${digits}@bookings.brightsmile.ph`;
}

export async function bookAppointment(
  data: BookingFormData,
  options?: { slotIso?: string }
): Promise<BookAppointmentResult> {
  const parsed = bookingSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid booking data",
    };
  }

  if (!getSupabaseUrl() || !getSupabaseServiceKey()) {
    return {
      success: false,
      error: "Booking is not configured. Please contact the clinic.",
    };
  }

  const booking = parsed.data;
  let calSynced = false;

  const calLink = getCalLink();
  const calParsed = parseCalLink(calLink);
  if (getCalApiKey() && calParsed) {
    const start =
      options?.slotIso ??
      buildBookingStartIso(
        booking.appointmentDate,
        booking.startHour,
        getClinicTimeZone()
      );

    const branch = getClinicLocationById(booking.clinicLocationId);

    const calResult = await createCalBooking(calParsed, {
      start,
      name: booking.patientName,
      email: attendeeEmail(booking),
      clinicCalValue: branch.calValue,
      phone: booking.patientPhone,
      metadata: {
        service: booking.service,
        source: CLINIC.name,
        ...(booking.notes ? { notes: booking.notes } : {}),
      },
    });

    if (!calResult.ok) {
      return {
        success: false,
        error: calResult.error ?? "Could not confirm on calendar.",
      };
    }
    calSynced = true;
  }

  const supabase = createServiceClient();
  const row = bookingToDbRow(booking);

  const { data: appointment, error } = await supabase
    .from("appointments")
    .insert(row)
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return {
        success: false,
        error: "This slot was just taken. Please choose another time.",
      };
    }
    return {
      success: false,
      error: "Failed to book appointment. Please try again.",
    };
  }

  revalidatePath("/book");
  return { success: true, id: appointment.id, calSynced };
}
