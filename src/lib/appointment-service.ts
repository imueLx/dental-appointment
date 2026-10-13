import {
  buildBookingStartIso,
  createCalBooking,
  cancelCalBooking,
  dateKeyFromSlotIso,
  findCalBookingAtSlot,
  findCalBookingsForPhone,
  hourFromCalSlot,
  isCalAlreadyBookedMessage,
  rescheduleCalBooking,
  getCalApiKey,
  getClinicTimeZone,
  parseCalLink,
  type CalListedBooking,
} from "@/lib/cal";
import { CLINIC, CLINIC_LOCATIONS, getClinicLocationById } from "@/lib/constants";
import {
  getCalLink,
  getSupabaseServiceKey,
  getSupabaseUrl,
  getSupabaseUrlError,
} from "@/lib/env";
import { buildBookingIdempotencyKey } from "@/lib/idempotency";
import { getBookedSlots } from "@/lib/appointments";
import { logErrorWithCause } from "@/lib/log-error";
import {
  normalizePhMobile,
  phoneDigitsOnly,
  phoneLookupSuffix,
  toPhE164,
} from "@/lib/phone";
import { createServiceClient } from "@/lib/supabase/admin";
import {
  formatDateKey,
  hourToTimeString,
  isSlotBookable,
  normalizeStartHour,
  parseDateKey,
  parseTimeToHour,
  resolveAppointmentDate,
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
  clinic_location_id?: string | null;
  idempotency_key?: string | null;
  created_at: string;
};

export type PublicAppointment = {
  id: string;
  appointmentDate: string;
  startHour: number;
  slotIso: string;
  service: string;
  clinicLocationId: string;
  patientName: string;
  calBookingUid?: string | null;
  status?: string;
};

export type CreateAppointmentResult =
  | {
      success: true;
      duplicate?: boolean;
      id: string;
      calSynced: boolean;
      calBookingUid?: string;
      appointment: PublicAppointment;
    }
  | {
      success: false;
      code: "validation" | "slot_taken" | "server" | "config";
      error: string;
      field?: string;
      calendarBookingId?: string;
      httpStatus: 400 | 409 | 500;
    };

export type AppointmentActionResult =
  | { success: true; appointment: AppointmentRow; duplicate?: boolean }
  | {
      success: false;
      code: "validation" | "slot_taken" | "not_found" | "server" | "config";
      error: string;
      field?: string;
      httpStatus: 400 | 404 | 409 | 500;
    };

function attendeeEmailFromPatient(
  patientEmail: string,
  patientPhone: string
): string {
  if (patientEmail?.trim()) return patientEmail.trim();
  const digits =
    normalizePhMobile(patientPhone) ?? phoneDigitsOnly(patientPhone);
  return `booking+${digits}@bookings.brightsmile.ph`;
}

/** @deprecated Prefer normalizePhMobile — kept for existing imports. */
export function normalizePhoneDigits(phone: string): string {
  return normalizePhMobile(phone) ?? phoneDigitsOnly(phone);
}

function isConfigured(): boolean {
  return Boolean(getSupabaseUrl() && getSupabaseServiceKey() && !getSupabaseUrlError());
}

export function resolveClinicLocationId(
  row: Pick<AppointmentRow, "clinic_location_id" | "notes">
): string {
  if (row.clinic_location_id) return row.clinic_location_id;
  const match = row.notes?.match(/Branch:\s*(.+)/);
  const calValue = match?.[1]?.trim();
  if (calValue) {
    const loc = CLINIC_LOCATIONS.find((l) => l.calValue === calValue);
    if (loc) return loc.id;
  }
  return CLINIC_LOCATIONS[0].id;
}

export function toPublicAppointment(row: AppointmentRow): PublicAppointment {
  const startHour = parseTimeToHour(row.start_time);
  const clinicLocationId = resolveClinicLocationId(row);
  return {
    id: row.id,
    appointmentDate: row.appointment_date,
    startHour,
    slotIso: buildBookingStartIso(
      row.appointment_date,
      startHour,
      getClinicTimeZone()
    ),
    service: row.service,
    clinicLocationId,
    patientName: row.patient_name,
    calBookingUid: row.cal_booking_uid,
    status: row.status,
  };
}

function samePatientPhone(a: string, b: string): boolean {
  const na = phoneLookupSuffix(a);
  const nb = phoneLookupSuffix(b);
  return Boolean(na && nb && na === nb);
}

function validationFailure(
  error: string,
  field?: string
): CreateAppointmentResult {
  return {
    success: false,
    code: "validation",
    error,
    field,
    httpStatus: 400,
  };
}

function successFromRow(
  row: AppointmentRow,
  opts?: { duplicate?: boolean; calSynced?: boolean }
): CreateAppointmentResult {
  return {
    success: true,
    duplicate: opts?.duplicate,
    id: row.id,
    calSynced: opts?.calSynced ?? Boolean(row.cal_booking_uid),
    calBookingUid: row.cal_booking_uid ?? undefined,
    appointment: toPublicAppointment(row),
  };
}

export async function createAppointment(
  data: BookingFormData | Record<string, unknown>,
  options?: { slotIso?: string; idempotencyKey?: string }
): Promise<CreateAppointmentResult> {
  const coerced = {
    ...data,
    startHour:
      typeof (data as { startHour?: unknown }).startHour === "string"
        ? Number((data as { startHour: string }).startHour)
        : (data as { startHour?: unknown }).startHour,
    patientPhone: String(
      (data as { patientPhone?: unknown }).patientPhone ?? ""
    ),
    patientEmail: String(
      (data as { patientEmail?: unknown }).patientEmail ?? ""
    ),
  };
  const parsed = bookingSchema.safeParse(coerced);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field =
      issue?.path?.[0] != null ? String(issue.path[0]) : undefined;
    return validationFailure(
      issue?.message ?? "Invalid booking data",
      field
    );
  }

  if (!isConfigured()) {
    const urlError = getSupabaseUrlError();
    return {
      success: false,
      code: "config",
      error:
        urlError ??
        "Booking is not configured. Please contact the clinic.",
      httpStatus: 500,
    };
  }

  const booking = parsed.data;
  const slotIso =
    options?.slotIso?.trim() ||
    buildBookingStartIso(
      booking.appointmentDate,
      booking.startHour,
      getClinicTimeZone()
    );

  const idempotencyKey =
    options?.idempotencyKey?.trim() ||
    buildBookingIdempotencyKey(
      booking.patientPhone,
      slotIso,
      booking.clinicLocationId
    );

  let supabase;
  try {
    supabase = createServiceClient();
  } catch (err) {
    logErrorWithCause("createAppointment: createServiceClient", err);
    return {
      success: false,
      code: "config",
      error: err instanceof Error ? err.message : "Database not configured",
      httpStatus: 500,
    };
  }

  // Idempotent: same key already confirmed
  const { data: byKey, error: byKeyError } = await supabase
    .from("appointments")
    .select("*")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  if (byKeyError) {
    logErrorWithCause("createAppointment: idempotency lookup", byKeyError);
  }

  if (byKey && byKey.status === "confirmed") {
    return successFromRow(byKey as AppointmentRow, {
      duplicate: true,
      calSynced: Boolean(byKey.cal_booking_uid),
    });
  }

  // Slot occupied?
  const { data: slotHolders, error: slotError } = await supabase
    .from("appointments")
    .select("*")
    .eq("appointment_date", booking.appointmentDate)
    .eq("start_time", hourToTimeString(booking.startHour))
    .in("status", ["confirmed", "pending"]);

  if (slotError) {
    logErrorWithCause("createAppointment: slot lookup", slotError);
    return {
      success: false,
      code: "server",
      error: "Failed to check slot availability",
      httpStatus: 500,
    };
  }

  const holders = (slotHolders ?? []) as AppointmentRow[];
  const otherPatient = holders.find(
    (h) =>
      h.idempotency_key !== idempotencyKey &&
      !samePatientPhone(h.patient_phone, booking.patientPhone)
  );
  if (otherPatient) {
    return {
      success: false,
      code: "slot_taken",
      error: "slot_taken",
      httpStatus: 409,
    };
  }

  const samePatientHold = holders.find(
    (h) =>
      h.idempotency_key === idempotencyKey ||
      samePatientPhone(h.patient_phone, booking.patientPhone)
  );

  if (samePatientHold?.status === "confirmed") {
    return successFromRow(samePatientHold, {
      duplicate: true,
      calSynced: Boolean(samePatientHold.cal_booking_uid),
    });
  }

  const date = parseDateKey(booking.appointmentDate);
  const bookedSlots = await getBookedSlots(
    booking.appointmentDate,
    booking.appointmentDate
  );
  const bookedExcludingSelf = bookedSlots.filter(
    (s) =>
      !(
        samePatientHold &&
        s.appointment_date === samePatientHold.appointment_date &&
        parseTimeToHour(s.start_time) ===
          parseTimeToHour(samePatientHold.start_time)
      )
  );
  if (!isSlotBookable(date, booking.startHour, bookedExcludingSelf)) {
    // Local availability says no — but if we already hold it, continue
    if (!samePatientHold) {
      return {
        success: false,
        code: "slot_taken",
        error: "slot_taken",
        httpStatus: 409,
      };
    }
  }

  const branch = getClinicLocationById(booking.clinicLocationId);
  const baseRow = {
    ...bookingToDbRow(booking),
    status: "pending" as const,
    clinic_location_id: booking.clinicLocationId,
    idempotency_key: idempotencyKey,
  };

  let pendingId = samePatientHold?.id;
  let existingCalUid = samePatientHold?.cal_booking_uid ?? null;

  if (!pendingId) {
    const { data: inserted, error: insertError } = await supabase
      .from("appointments")
      .insert(baseRow)
      .select("*")
      .single();

    if (insertError) {
      if (insertError.code === "23505") {
        // Race: re-read by idempotency key, then by slot
        const { data: byKeyAgain } = await supabase
          .from("appointments")
          .select("*")
          .eq("idempotency_key", idempotencyKey)
          .maybeSingle();

        const { data: bySlotAgain } = byKeyAgain
          ? { data: null }
          : await supabase
              .from("appointments")
              .select("*")
              .eq("appointment_date", booking.appointmentDate)
              .eq("start_time", hourToTimeString(booking.startHour))
              .in("status", ["confirmed", "pending"])
              .maybeSingle();

        const raced = (byKeyAgain ?? bySlotAgain) as AppointmentRow | null;

        if (raced) {
          if (raced.status === "confirmed") {
            if (samePatientPhone(raced.patient_phone, booking.patientPhone)) {
              return successFromRow(raced, { duplicate: true });
            }
            return {
              success: false,
              code: "slot_taken",
              error: "slot_taken",
              httpStatus: 409,
            };
          }
          pendingId = raced.id;
          existingCalUid = raced.cal_booking_uid;
        } else {
          return {
            success: false,
            code: "slot_taken",
            error: "slot_taken",
            httpStatus: 409,
          };
        }
      } else {
        logErrorWithCause("createAppointment: pending insert", insertError);
        return {
          success: false,
          code: "server",
          error: "Failed to book appointment. Please try again.",
          httpStatus: 500,
        };
      }
    } else {
      pendingId = inserted.id;
    }
  } else if (samePatientHold?.status === "pending") {
    await supabase
      .from("appointments")
      .update({
        patient_name: booking.patientName,
        patient_email: booking.patientEmail || "",
        patient_phone: booking.patientPhone,
        service: booking.service,
        notes: baseRow.notes,
        clinic_location_id: booking.clinicLocationId,
        idempotency_key: idempotencyKey,
      })
      .eq("id", pendingId);
  }

  if (!pendingId) {
    return {
      success: false,
      code: "server",
      error: "Failed to book appointment. Please try again.",
      httpStatus: 500,
    };
  }

  let calBookingUid = existingCalUid ?? undefined;
  let calSynced = Boolean(calBookingUid);

  const calLink = getCalLink();
  const calParsed = parseCalLink(calLink);

  if (!calBookingUid && getCalApiKey() && calParsed) {
    const attendeeEmail = attendeeEmailFromPatient(
      booking.patientEmail,
      booking.patientPhone
    );
    const calResult = await createCalBooking(calParsed, {
      start: slotIso,
      name: booking.patientName,
      email: attendeeEmail,
      clinicCalValue: branch.calValue,
      clinicAddress: branch.address,
      phone: toPhE164(booking.patientPhone),
      metadata: {
        service: booking.service,
        source: CLINIC.name,
        idempotencyKey,
        ...(booking.notes ? { notes: booking.notes } : {}),
      },
    });

    if (!calResult.ok) {
      const alreadyBooked =
        calResult.code === "already_booked" ||
        isCalAlreadyBookedMessage(calResult.error);

      if (alreadyBooked) {
        const { booking: calBooking, samePatient } =
          await findCalBookingAtSlot(slotIso, {
            phone: booking.patientPhone,
            name: booking.patientName,
            email: attendeeEmail,
          });

        if (calBooking && samePatient) {
          const repaired = await repairDbFromCalBooking(supabase, {
            calBooking,
            pendingId,
            patientPhone: booking.patientPhone,
            patientName: booking.patientName,
            patientEmail: booking.patientEmail,
            service: booking.service,
            clinicLocationId: booking.clinicLocationId,
            idempotencyKey,
            slotIso,
          });
          if (repaired) {
            return successFromRow(repaired, {
              duplicate: true,
              calSynced: true,
            });
          }
        }

        await supabase.from("appointments").delete().eq("id", pendingId);

        return {
          success: false,
          code: "slot_taken",
          error: "slot_taken",
          httpStatus: 409,
        };
      }

      await supabase.from("appointments").delete().eq("id", pendingId);

      return {
        success: false,
        code: "server",
        error: calResult.error ?? "Could not confirm on calendar.",
        httpStatus: 500,
      };
    }

    calBookingUid = calResult.uid;
    calSynced = true;
  }

  const { data: confirmed, error: confirmError } = await supabase
    .from("appointments")
    .update({
      status: "confirmed",
      ...(calBookingUid ? { cal_booking_uid: calBookingUid } : {}),
    })
    .eq("id", pendingId)
    .select("*")
    .single();

  if (confirmError || !confirmed) {
    logErrorWithCause("createAppointment: confirm update", confirmError);

    if (calBookingUid) {
      const rollback = await cancelCalBooking(
        calBookingUid,
        "Rollback: failed to confirm local appointment record"
      );
      if (!rollback.ok) {
        console.error(
          "CRITICAL: calendar booking orphaned after DB confirm failure",
          { calBookingUid, pendingId, rollbackError: rollback.error }
        );
        return {
          success: false,
          code: "server",
          error:
            "Booking created on calendar but could not be saved. Please contact the clinic.",
          calendarBookingId: calBookingUid,
          httpStatus: 500,
        };
      }
    }

    await supabase.from("appointments").delete().eq("id", pendingId);

    return {
      success: false,
      code: "server",
      error: "Failed to book appointment. Please try again.",
      httpStatus: 500,
    };
  }

  return successFromRow(confirmed as AppointmentRow, {
    duplicate: false,
    calSynced,
  });
}

export async function findAppointmentsByPhone(
  phone: string,
  options?: { upcomingOnly?: boolean }
): Promise<PublicAppointment[]> {
  const normalized = normalizePhMobile(phone);
  const last10 = phoneLookupSuffix(phone);
  if (!last10 && !normalized) return [];

  const today = formatDateKey(new Date());
  const suffix = normalized ?? last10!;

  try {
    const supabase = createServiceClient();
    let query = supabase
      .from("appointments")
      .select("*")
      .eq("status", "confirmed")
      .ilike("patient_phone", `%${suffix}%`)
      .order("appointment_date")
      .order("start_time");

    if (options?.upcomingOnly !== false) {
      query = query.gte("appointment_date", today);
    }

    const { data, error } = await query;
    if (error) {
      logErrorWithCause("findAppointmentsByPhone", error);
      throw new Error(error.message);
    }

    return ((data ?? []) as AppointmentRow[]).map(toPublicAppointment);
  } catch (err) {
    logErrorWithCause("findAppointmentsByPhone fetch", err);
    throw err;
  }
}

export async function cancelAppointment(
  id: string
): Promise<AppointmentActionResult> {
  if (!isConfigured()) {
    return {
      success: false,
      code: "config",
      error: "Booking is not configured. Please contact the clinic.",
      httpStatus: 500,
    };
  }

  const appointmentId = id.trim();
  if (!appointmentId) {
    return {
      success: false,
      code: "validation",
      error: "Missing appointment id",
      field: "id",
      httpStatus: 400,
    };
  }

  try {
    const supabase = createServiceClient();
    const { data: existing, error: fetchError } = await supabase
      .from("appointments")
      .select("*")
      .eq("id", appointmentId)
      .maybeSingle();

    if (fetchError) {
      logErrorWithCause("cancelAppointment: fetch", fetchError);
      return {
        success: false,
        code: "server",
        error: fetchError.message,
        httpStatus: 500,
      };
    }

    if (!existing) {
      return {
        success: false,
        code: "not_found",
        error: "Appointment not found",
        httpStatus: 404,
      };
    }

    if (existing.status === "cancelled") {
      return { success: true, appointment: existing as AppointmentRow, duplicate: true };
    }

    const { data, error } = await supabase
      .from("appointments")
      .update({ status: "cancelled" })
      .eq("id", appointmentId)
      .select()
      .maybeSingle();

    if (error) {
      logErrorWithCause("cancelAppointment: update", error);
      return {
        success: false,
        code: "server",
        error: error.message,
        httpStatus: 500,
      };
    }

    const cancelledRow = (data ?? existing) as AppointmentRow;
    cancelledRow.status = "cancelled";

    if (existing.cal_booking_uid && getCalApiKey()) {
      const calResult = await cancelCalBooking(existing.cal_booking_uid);
      if (!calResult.ok) {
        console.error(
          "Cal cancel failed after local cancel:",
          calResult.error,
          existing.cal_booking_uid
        );
      }
    }

    return { success: true, appointment: cancelledRow };
  } catch (err) {
    logErrorWithCause("cancelAppointment", err);
    return {
      success: false,
      code: "server",
      error: err instanceof Error ? err.message : "Cancel failed",
      httpStatus: 500,
    };
  }
}

export async function rescheduleAppointment(
  id: string,
  params: { appointmentDate: string; startHour: number; slotIso?: string }
): Promise<AppointmentActionResult> {
  if (!isConfigured()) {
    return {
      success: false,
      code: "config",
      error: "Booking is not configured. Please contact the clinic.",
      httpStatus: 500,
    };
  }

  const appointmentDate = resolveAppointmentDate(
    params.appointmentDate,
    params.slotIso
  );
  const startHour = normalizeStartHour(params.startHour);
  const { slotIso } = params;

  if (!appointmentDate) {
    return {
      success: false,
      code: "validation",
      error: `Invalid date format (got ${JSON.stringify(params.appointmentDate)}; use YYYY-MM-DD or a valid slotIso)`,
      field: "appointmentDate",
      httpStatus: 400,
    };
  }
  if (startHour === undefined) {
    return {
      success: false,
      code: "validation",
      error: "Invalid startHour",
      field: "startHour",
      httpStatus: 400,
    };
  }

  try {
    const supabase = createServiceClient();
    const { data: existing, error: fetchError } = await supabase
      .from("appointments")
      .select("*")
      .eq("id", id)
      .neq("status", "cancelled")
      .single();

    if (fetchError || !existing) {
      return {
        success: false,
        code: "not_found",
        error: "Appointment not found",
        httpStatus: 404,
      };
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
        code: "slot_taken",
        error: "slot_taken",
        httpStatus: 409,
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
            code: "server",
            error: calResult.error ?? "Could not reschedule on calendar.",
            httpStatus: 500,
          };
        }
        if (calResult.uid) newCalBookingUid = calResult.uid;
      } else {
        const branch = getClinicLocationById(
          resolveClinicLocationId(existing as AppointmentRow)
        );
        const calResult = await createCalBooking(calParsed, {
          start,
          name: existing.patient_name,
          email: attendeeEmailFromPatient(
            existing.patient_email,
            existing.patient_phone
          ),
          clinicCalValue: branch.calValue,
          clinicAddress: branch.address,
          phone: toPhE164(existing.patient_phone),
          metadata: { service: existing.service, source: CLINIC.name },
        });
        if (!calResult.ok) {
          return {
            success: false,
            code: "server",
            error: calResult.error ?? "Could not confirm on calendar.",
            httpStatus: 500,
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
          code: "slot_taken",
          error: "slot_taken",
          httpStatus: 409,
        };
      }
      logErrorWithCause("rescheduleAppointment: update", error);
      return {
        success: false,
        code: "server",
        error: error.message,
        httpStatus: 500,
      };
    }

    return { success: true, appointment: data as AppointmentRow };
  } catch (err) {
    logErrorWithCause("rescheduleAppointment", err);
    return {
      success: false,
      code: "server",
      error: err instanceof Error ? err.message : "Reschedule failed",
      httpStatus: 500,
    };
  }
}
