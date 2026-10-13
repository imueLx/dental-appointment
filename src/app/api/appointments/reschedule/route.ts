import { NextRequest, NextResponse } from "next/server";
import { rescheduleResultToResponse } from "@/lib/api-booking-response";
import { rescheduleAppointment } from "@/lib/appointment-service";
import { logErrorWithCause } from "@/lib/log-error";
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
 */
export async function POST(request: NextRequest) {
  if (!verifyApiKey(request)) {
    return NextResponse.json(
      { rescheduled: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const id = typeof body.id === "string" ? body.id.trim() : "";
    const slotIso =
      typeof body.slotIso === "string" ? body.slotIso.trim() : body.slotIso;
    const appointmentDate = resolveAppointmentDate(
      body.appointmentDate,
      slotIso
    );
    const startHour =
      normalizeStartHour(body.startHour) ??
      (body.startTime ? parseTimeToHour(body.startTime) : undefined);

    if (!id || !appointmentDate || startHour === undefined) {
      const field = !id
        ? "id"
        : !appointmentDate
          ? "appointmentDate"
          : "startHour";
      return NextResponse.json(
        {
          rescheduled: false,
          error: "validation",
          field,
          message:
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

    return rescheduleResultToResponse(result);
  } catch (err) {
    logErrorWithCause("POST /api/appointments/reschedule", err);
    return NextResponse.json(
      { rescheduled: false, error: "Invalid request body" },
      { status: 400 }
    );
  }
}
