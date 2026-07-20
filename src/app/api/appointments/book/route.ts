import { NextRequest, NextResponse } from "next/server";
import { createAppointment } from "@/lib/appointment-service";
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
 *
 * n8n-friendly alias of POST /api/appointments (same booking logic).
 */
export async function POST(request: NextRequest) {
  if (!verifyApiKey(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const startHour =
      body.startHour ??
      (body.startTime ? parseTimeToHour(body.startTime) : undefined);

    if (
      !body.appointmentDate ||
      startHour === undefined ||
      !body.clinicLocationId ||
      !body.patientName ||
      !body.patientPhone ||
      !body.service
    ) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: appointmentDate, startHour, clinicLocationId, patientName, patientPhone, service",
        },
        { status: 400 }
      );
    }

    const result = await createAppointment(
      {
        ...body,
        startHour,
        patientEmail: body.patientEmail ?? "",
      },
      { slotIso: body.slotIso }
    );

    if (!result.success) {
      const status = result.error.includes("just taken") ? 409 : 400;
      return NextResponse.json({ error: result.error }, { status });
    }

    return NextResponse.json(
      {
        appointment: {
          id: result.id,
          calSynced: result.calSynced,
          calBookingUid: result.calBookingUid,
        },
        booked: true,
        message: "Appointment booked successfully.",
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}
