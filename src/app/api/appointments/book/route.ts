import { NextRequest, NextResponse } from "next/server";
import { bookResultToResponse } from "@/lib/api-booking-response";
import { createAppointment } from "@/lib/appointment-service";
import { logErrorWithCause } from "@/lib/log-error";
import { parseTimeToHour } from "@/lib/slots";

function verifyApiKey(request: NextRequest): boolean {
  const secret = process.env.APPOINTMENT_API_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

/**
 * POST /api/appointments/book
 * Body: appointmentDate, startHour, clinicLocationId, patientName,
 *       patientPhone, patientEmail?, service, slotIso?
 * Optional header: Idempotency-Key
 */
export async function POST(request: NextRequest) {
  if (!verifyApiKey(request)) {
    return NextResponse.json(
      { booked: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const startHourRaw =
      body.startHour ??
      (body.startTime ? parseTimeToHour(body.startTime) : undefined);
    const startHour =
      typeof startHourRaw === "string"
        ? Number(startHourRaw)
        : startHourRaw;

    if (
      !body.appointmentDate ||
      startHour === undefined ||
      (typeof startHour === "number" && !Number.isFinite(startHour)) ||
      !body.clinicLocationId ||
      !body.patientName ||
      !body.patientPhone ||
      !body.service
    ) {
      const missing = [
        !body.appointmentDate && "appointmentDate",
        (startHour === undefined ||
          (typeof startHour === "number" && !Number.isFinite(startHour))) &&
          "startHour",
        !body.clinicLocationId && "clinicLocationId",
        !body.patientName && "patientName",
        !body.patientPhone && "patientPhone",
        !body.service && "service",
      ].filter(Boolean)[0] as string;

      return NextResponse.json(
        {
          booked: false,
          error: "validation",
          field: missing,
          message: `Missing required field: ${missing}`,
        },
        { status: 400 }
      );
    }

    const idempotencyKey =
      request.headers.get("idempotency-key") ??
      request.headers.get("Idempotency-Key") ??
      undefined;

    const result = await createAppointment(
      {
        ...body,
        startHour,
        patientEmail: body.patientEmail ?? "",
      },
      { slotIso: body.slotIso, idempotencyKey }
    );

    return bookResultToResponse(result);
  } catch (err) {
    logErrorWithCause("POST /api/appointments/book", err);
    return NextResponse.json(
      { booked: false, error: "Invalid request body" },
      { status: 400 }
    );
  }
}
