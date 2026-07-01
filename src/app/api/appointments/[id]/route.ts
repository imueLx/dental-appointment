import { NextRequest, NextResponse } from "next/server";
import {
  cancelAppointment,
  rescheduleAppointment,
} from "@/lib/appointment-service";
import { parseTimeToHour } from "@/lib/slots";

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
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const startHour =
      body.startHour ??
      (body.startTime ? parseTimeToHour(body.startTime) : undefined);

    if (!body.appointmentDate || startHour === undefined) {
      return NextResponse.json(
        { error: "Missing required fields: appointmentDate, startHour" },
        { status: 400 }
      );
    }

    const result = await rescheduleAppointment(id, {
      appointmentDate: body.appointmentDate,
      startHour,
      slotIso: body.slotIso,
    });

    if (!result.success) {
      const status = result.error.includes("just taken") ? 409 : 400;
      return NextResponse.json({ error: result.error }, { status });
    }

    return NextResponse.json({ appointment: result.appointment });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!verifyApiKey(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const result = await cancelAppointment(id);

  if (!result.success) {
    const status = result.error === "Appointment not found" ? 404 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ appointment: result.appointment });
}
