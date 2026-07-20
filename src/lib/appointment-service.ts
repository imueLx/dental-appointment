import {
  buildBookingStartIso,
  createCalBooking,
  cancelCalBooking,
  rescheduleCalBooking,
  getCalApiKey,
  getClinicTimeZone,
  parseCalLink,
} from "@/lib/cal";
import { CLINIC, getClinicLocationById } from "@/lib/constants";
import {
  getCalLink,
  getSupabaseServiceKey,
  getSupabaseUrl,
} from "@/lib/env";
import { getBookedSlots } from "@/lib/appointments";
import { createServiceClient } from "@/lib/supabase/admin";
import {
  formatDateKey,
  hourToTimeString,
  isSlotBookable,
  parseDateKey,
  parseTimeToHour,
} from "@/lib/slots";
import {
  bookingSchema,
  bookingToDbRow,
  type BookingFormData,
} from "@/lib/validators";

export type AppointmentRow = {
  id: string;
  appointment_date: string;
  start_time: string;
  patient_name: string;
  patient_email: string;
  patient_phone: string;
  service: string;
  notes: string | null;
  status: string;
  cal_booking_uid: string | null;
  created_at: string;
};

export type CreateAppointmentResult =
  | { success: true; id: string; calSynced: boolean; calBookingUid?: string }
  | { success: false; error: string };

export type AppointmentActionResult =
  | { success: true; appointment: AppointmentRow }
  | { success: false; error: string };

function attendeeEmailFromPatient(
  patientEmail: string,
  patientPhone: string
): string {
  if (patientEmail?.trim()) return patientEmail.trim();
  const digits = patientPhone.replace(/\D/g, "");
  return `booking+${digits}@bookings.brightsmile.ph`;
}

export function normalizePhoneDigits(phone: string): string {
  return phone.replace(/\D/g, "");
}

function isConfigured(): boolean {
  return Boolean(getSupabaseUrl() && getSupabaseServiceKey());
}

export async function createAppointment(
  data: BookingFormData,
  options?: { slotIso?: string }
): Promise<CreateAppointmentResult> {
  const parsed = bookingSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid booking data",
    };
  }

  if (!isConfigured()) {
    return {
      success: false,
      error: "Booking is not configured. Please contact the clinic.",
    };
  }

  const booking = parsed.data;

  const date = parseDateKey(booking.appointmentDate);
  const bookedSlots = await getBookedSlots(
    booking.appointmentDate,
    booking.appointmentDate
  );
  if (!isSlotBookable(date, booking.startHour, bookedSlots)) {
    return {
      success: false,
      error: "That time slot is not available. Please choose another.",
    };
  }

  let calSynced = false;
  let calBookingUid: string | undefined;

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
      email: attendeeEmailFromPatient(
        booking.patientEmail,
        booking.patientPhone
      ),
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
    calBookingUid = calResult.uid;
  }

  const supabase = createServiceClient();
  const row = {
    ...bookingToDbRow(booking),
    ...(calBookingUid ? { cal_booking_uid: calBookingUid } : {}),
  };

  const { data: appointment, error } = await supabase
    .from("appointments")
    .insert(row)
    .select("id, cal_booking_uid")
    .single();

  if (error) {
    if (error.code === "23505") {
      // Likely raced with /api/cal-webhook after Cal.com create
      if (calBookingUid) {
        const { data: existing } = await supabase
          .from("appointments")
          .select("id, cal_booking_uid")
          .eq("cal_booking_uid", calBookingUid)
          .maybeSingle();
        if (existing) {
          return {
            success: true,
            id: existing.id,
            calSynced: true,
            calBookingUid: existing.cal_booking_uid ?? calBookingUid,
          };
        }
      }
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

  return {
    success: true,
    id: appointment.id,
    calSynced,
    calBookingUid: appointment.cal_booking_uid ?? calBookingUid,
  };
}

export async function findAppointmentsByPhone(
  phone: string,
  options?: { upcomingOnly?: boolean }
): Promise<AppointmentRow[]> {
  const digits = normalizePhoneDigits(phone);
  if (digits.length < 10) return [];

  const last10 = digits.slice(-10);
  const today = formatDateKey(new Date());

  const supabase = createServiceClient();
  let query = supabase
    .from("appointments")
    .select("*")
    .eq("status", "confirmed")
    .ilike("patient_phone", `%${last10}%`)
    .order("appointment_date")
    .order("start_time");

  if (options?.upcomingOnly !== false) {
    query = query.gte("appointment_date", today);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data ?? []) as AppointmentRow[];
}

export async function cancelAppointment(
  id: string
): Promise<AppointmentActionResult> {
  if (!isConfigured()) {
    return {
      success: false,
      error: "Booking is not configured. Please contact the clinic.",
    };
  }

  const supabase = createServiceClient();
  const { data: existing, error: fetchError } = await supabase
    .from("appointments")
    .select("*")
    .eq("id", id)
    .neq("status", "cancelled")
    .single();

  if (fetchError || !existing) {
    return { success: false, error: "Appointment not found" };
  }

  if (existing.cal_booking_uid && getCalApiKey()) {
    const calResult = await cancelCalBooking(existing.cal_booking_uid);
    if (!calResult.ok) {
      return {
        success: false,
        error: calResult.error ?? "Could not cancel on calendar.",
      };
    }
  }

  const { data, error } = await supabase
    .from("appointments")
    .update({ status: "cancelled" })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, appointment: data as AppointmentRow };
}

export async function rescheduleAppointment(
  id: string,
  params: { appointmentDate: string; startHour: number; slotIso?: string }
): Promise<AppointmentActionResult> {
  if (!isConfigured()) {
    return {
      success: false,
      error: "Booking is not configured. Please contact the clinic.",
    };
  }

  const { appointmentDate, startHour, slotIso } = params;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(appointmentDate)) {
    return { success: false, error: "Invalid date format" };
  }

  const supabase = createServiceClient();
  const { data: existing, error: fetchError } = await supabase
    .from("appointments")
    .select("*")
    .eq("id", id)
    .neq("status", "cancelled")
    .single();

  if (fetchError || !existing) {
    return { success: false, error: "Appointment not found" };
  }

  const date = parseDateKey(appointmentDate);
  const bookedSlots = await getBookedSlots(appointmentDate, appointmentDate);
  const otherBooked = bookedSlots.filter(
    (slot) =>
      !(
        slot.appointment_date === existing.appointment_date &&
        parseTimeToHour(slot.start_time) ===
          parseTimeToHour(existing.start_time)
      )
  );

  if (!isSlotBookable(date, startHour, otherBooked)) {
    return {
      success: false,
      error: "That time slot is not available. Please choose another.",
    };
  }

  const start =
    slotIso ??
    buildBookingStartIso(appointmentDate, startHour, getClinicTimeZone());

  let newCalBookingUid = existing.cal_booking_uid;

  const calLink = getCalLink();
  const calParsed = parseCalLink(calLink);

  if (getCalApiKey() && calParsed) {
    if (existing.cal_booking_uid) {
      const calResult = await rescheduleCalBooking(
        existing.cal_booking_uid,
        start
      );
      if (!calResult.ok) {
        return {
          success: false,
          error: calResult.error ?? "Could not reschedule on calendar.",
        };
      }
      if (calResult.uid) newCalBookingUid = calResult.uid;
    } else {
      const branchMatch = existing.notes?.match(/Branch: (.+)/);
      const branchCalValue =
        branchMatch?.[1]?.trim() ?? "SM Southmall BrightSmile";
      const calResult = await createCalBooking(calParsed, {
        start,
        name: existing.patient_name,
        email: attendeeEmailFromPatient(
          existing.patient_email,
          existing.patient_phone
        ),
        clinicCalValue: branchCalValue,
        phone: existing.patient_phone,
        metadata: { service: existing.service, source: CLINIC.name },
      });
      if (!calResult.ok) {
        return {
          success: false,
          error: calResult.error ?? "Could not confirm on calendar.",
        };
      }
      if (calResult.uid) newCalBookingUid = calResult.uid;
    }
  }

  const { data, error } = await supabase
    .from("appointments")
    .update({
      appointment_date: appointmentDate,
      start_time: hourToTimeString(startHour),
      cal_booking_uid: newCalBookingUid,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return {
        success: false,
        error: "This slot was just taken. Please choose another time.",
      };
    }
    return { success: false, error: error.message };
  }

  return { success: true, appointment: data as AppointmentRow };
}
