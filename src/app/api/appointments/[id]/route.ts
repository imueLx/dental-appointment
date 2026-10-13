import { NextRequest, NextResponse } from "next/server";
import {
  cancelResultToResponse,
  rescheduleResultToResponse,
} from "@/lib/api-booking-response";
import {
  cancelAppointment,
  rescheduleAppointment,
} from "@/lib/appointment-service";
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!verifyApiKey(request)) {
    return NextResponse.json(
      { rescheduled: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const slotIso =
      typeof body.slotIso === "string" ? body.slotIso.trim() : body.slotIso;
    const appointmentDate = resolveAppointmentDate(
      body.appointmentDate,
      slotIso
    );
    const startHour =
      normalizeStartHour(body.startHour) ??
      (body.startTime ? parseTimeToHour(body.startTime) : undefined);

    if (!appointmentDate || startHour === undefined) {
      return NextResponse.json(
        {
          rescheduled: false,
          error: "validation",
          field: !appointmentDate ? "appointmentDate" : "startHour",
          message: "Missing required fields: appointmentDate, startHour",
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
    logErrorWithCause("PATCH /api/appointments/[id]", err);
    return NextResponse.json(
      { rescheduled: false, error: "Invalid request body" },
      { status: 400 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!verifyApiKey(request)) {
    return NextResponse.json(
      { cancelled: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { id } = await params;
  const result = await cancelAppointment(id);
  return cancelResultToResponse(result);
}
