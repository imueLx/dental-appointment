import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { getClinicTimeZone } from "@/lib/cal";
import { hourToTimeString, SLOT_HOURS } from "@/lib/slots";
import { sendBookingConfirmationEmail } from "@/lib/email";

/**
 * Cal.com → Supabase sync so staff bookings made in the Cal dashboard
 * keep local availability accurate (manual UI + AI chat).
 *
 * Configure in Cal.com: Settings → Developer → Webhooks
 * URL: https://your-app.vercel.app/api/cal-webhook
 * Secret: same value as CAL_WEBHOOK_SECRET (sent as Bearer or ?secret=)
 * Events: BOOKING_CREATED, BOOKING_CANCELLED, BOOKING_RESCHEDULED
 */

type CalAttendee = { email?: string; name?: string; timeZone?: string };

type CalPayload = {
  uid?: string;
  startTime?: string;
  endTime?: string;
  title?: string;
  status?: string;
  attendees?: CalAttendee[];
  responses?: Record<string, { value?: string } | string>;
  metadata?: Record<string, string>;
};

type CalWebhookBody = {
  triggerEvent?: string;
  payload?: CalPayload;
};

function verifySecret(request: NextRequest): boolean {
  const secret = process.env.CAL_WEBHOOK_SECRET;
  if (!secret) return true; // allow if unset (dev); set in production
  const auth = request.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  const q = request.nextUrl.searchParams.get("secret");
  return q === secret;
}

function wallClockFromIso(iso: string, timeZone: string): { date: string; hour: number } | null {
  try {
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hour12: false,
    });
    const parts = Object.fromEntries(
      fmt.formatToParts(new Date(iso)).map((p) => [p.type, p.value])
    );
    const date = `${parts.year}-${parts.month}-${parts.day}`;
    let hour = parseInt(parts.hour ?? "", 10);
    // Intl may emit "24" for midnight in some runtimes
    if (hour === 24) hour = 0;
    if (!date || Number.isNaN(hour)) return null;
    return { date, hour };
  } catch {
    return null;
  }
}

function responseValue(
  responses: CalPayload["responses"],
  key: string
): string {
  const raw = responses?.[key];
  if (!raw) return "";
  if (typeof raw === "string") return raw;
  return raw.value ?? "";
}

export async function POST(request: NextRequest) {
  if (!verifySecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: CalWebhookBody;
  try {
    body = (await request.json()) as CalWebhookBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const event = body.triggerEvent ?? "";
  const payload = body.payload;
  if (!payload?.uid) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const uid = payload.uid;
  const supabase = createServiceClient();
  const timeZone = getClinicTimeZone();

  if (event === "BOOKING_CANCELLED") {
    const { error } = await supabase
      .from("appointments")
      .update({ status: "cancelled" })
      .eq("cal_booking_uid", uid)
      .neq("status", "cancelled");

    if (error) {
      console.error("cal-webhook cancel failed:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, action: "cancel" });
  }

  if (event !== "BOOKING_CREATED" && event !== "BOOKING_RESCHEDULED") {
    return NextResponse.json({ ok: true, skipped: true });
  }

  if (!payload.startTime) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const wall = wallClockFromIso(payload.startTime, timeZone);
  if (!wall || !(SLOT_HOURS as readonly number[]).includes(wall.hour)) {
    // Outside clinic slot grid — still store so staff bookings are visible
    console.warn("cal-webhook: start outside SLOT_HOURS", wall);
  }
  if (!wall) {
    return NextResponse.json({ error: "Could not parse startTime" }, { status: 400 });
  }

  const attendee = payload.attendees?.[0];
  const patientName =
    attendee?.name?.trim() ||
    responseValue(payload.responses, "name") ||
    "Cal.com guest";
  const patientEmail = attendee?.email?.trim() || "";
  const patientPhone =
    responseValue(payload.responses, "phone") ||
    responseValue(payload.responses, "Phone") ||
    responseValue(payload.responses, "smsReminderNumber") ||
    "";
  const service =
    payload.metadata?.service ||
    payload.title ||
    "Dental Appointment";
  const branchNote = responseValue(payload.responses, "Clinic-Address");
  const notes = [
    branchNote ? `Branch: ${branchNote}` : null,
    `Source: Cal.com dashboard`,
  ]
    .filter(Boolean)
    .join("\n");

  const { data: existing } = await supabase
    .from("appointments")
    .select("id, status")
    .eq("cal_booking_uid", uid)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("appointments")
      .update({
        appointment_date: wall.date,
        start_time: hourToTimeString(wall.hour),
        status: "confirmed",
        patient_name: patientName,
        patient_email: patientEmail,
        ...(patientPhone ? { patient_phone: patientPhone } : {}),
        service,
        notes,
      })
      .eq("id", existing.id);

    if (error) {
      console.error("cal-webhook update failed:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, action: "update", id: existing.id });
  }

  // Skip insert if this booking was already created by our app (race with API).
  // App inserts with cal_booking_uid right after Cal create — webhook may arrive twice.
  const { data: inserted, error: insertError } = await supabase
    .from("appointments")
    .insert({
      appointment_date: wall.date,
      start_time: hourToTimeString(wall.hour),
      patient_name: patientName,
      patient_email: patientEmail,
      patient_phone: patientPhone || "0000000000",
      service,
      notes,
      status: "confirmed",
      cal_booking_uid: uid,
    })
    .select("id, patient_email, patient_name, appointment_date, start_time")
    .single();

  if (insertError) {
    // Unique on cal_booking_uid or slot — treat as ok
    if (insertError.code === "23505") {
      return NextResponse.json({ ok: true, skipped: true, reason: "duplicate" });
    }
    console.error("cal-webhook insert failed:", insertError.message);
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  if (inserted?.patient_email?.trim() && event === "BOOKING_CREATED") {
    try {
      await sendBookingConfirmationEmail({
        patientEmail: inserted.patient_email,
        patientName: inserted.patient_name,
        appointmentDate: inserted.appointment_date,
        startHour: wall.hour,
      });
    } catch (err) {
      console.error("cal-webhook email failed:", err);
    }
  }

  return NextResponse.json({ ok: true, action: "create", id: inserted?.id });
}
