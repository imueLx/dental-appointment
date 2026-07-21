import { NextRequest, NextResponse } from "next/server";
import { rescheduleAppointment } from "@/lib/appointment-service";
import {
  normalizeStartHour,
  parseTimeToHour,
  resolveAppointmentDate,
} from "@/lib/slots";

function verifyApiKey(request: NextRequest): boolean {
  const secret = process.env.APPOINTMENT_API_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

/**
 * POST /api/appointments/reschedule
 * Body: { id, appointmentDate, startHour, slotIso? }
 *
 * Prefer this for n8n (id in JSON body) — more reliable than PATCH .../appointments/{id}.
 */
export async function POST(request: NextRequest) {
  if (!verifyApiKey(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const id = typeof body.id === "string" ? body.id.trim() : "";
    const slotIso =
      typeof body.slotIso === "string" ? body.slotIso.trim() : body.slotIso;
    // LLMs sometimes truncate appointmentDate (e.g. "2026-0"); recover from slotIso.
    const appointmentDate = resolveAppointmentDate(
      body.appointmentDate,
      slotIso
    );
    const startHour =
      normalizeStartHour(body.startHour) ??
      (body.startTime ? parseTimeToHour(body.startTime) : undefined);

    if (!id || !appointmentDate || startHour === undefined) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: id, appointmentDate (YYYY-MM-DD), startHour (or startTime). If appointmentDate is incomplete, include a valid slotIso.",
        },
        { status: 400 }
      );
    }

    const result = await rescheduleAppointment(id, {
      appointmentDate,
      startHour,
      slotIso,
    });

    if (!result.success) {
      const status =
        result.error === "Appointment not found"
          ? 404
          : result.error.includes("just taken")
            ? 409
            : 400;
      return NextResponse.json({ error: result.error }, { status });
    }

    return NextResponse.json({
      appointment: result.appointment,
      rescheduled: true,
      message: "Appointment rescheduled successfully.",
    });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}
