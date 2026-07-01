import { NextRequest, NextResponse } from "next/server";
import { getAppointments } from "@/lib/appointments";
import {
  createAppointment,
  findAppointmentsByPhone,
} from "@/lib/appointment-service";
import { parseTimeToHour } from "@/lib/slots";

function verifyApiKey(request: NextRequest): boolean {
  const secret = process.env.APPOINTMENT_API_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!verifyApiKey(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const phone = searchParams.get("phone");

  if (phone) {
    try {
      const upcomingOnly = searchParams.get("upcomingOnly") !== "false";
      const appointments = await findAppointmentsByPhone(phone, { upcomingOnly });
      return NextResponse.json({ appointments });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Failed to fetch" },
        { status: 500 }
      );
    }
  }

  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!from || !to) {
    return NextResponse.json(
      { error: "Missing required query params: from, to (or phone)" },
      { status: 400 }
    );
  }

  try {
    const appointments = await getAppointments(from, to);
    return NextResponse.json({ appointments });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  if (!verifyApiKey(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const startHour =
      body.startHour ??
      (body.startTime ? parseTimeToHour(body.startTime) : undefined);

    const result = await createAppointment(
      {
        ...body,
        startHour,
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
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}
