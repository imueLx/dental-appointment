import { NextRequest, NextResponse } from "next/server";
import { bookResultToResponse } from "@/lib/api-booking-response";
import { getAppointments } from "@/lib/appointments";
import {
  createAppointment,
  findAppointmentsByPhone,
} from "@/lib/appointment-service";
import { logErrorWithCause } from "@/lib/log-error";
import { normalizePhMobile } from "@/lib/phone";
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
    const normalized = normalizePhMobile(phone);
    if (!normalized && phone.replace(/\D/g, "").length < 10) {
      return NextResponse.json({ appointments: [] });
    }

    try {
      const upcomingOnly = searchParams.get("upcomingOnly") !== "false";
      const appointments = await findAppointmentsByPhone(phone, {
        upcomingOnly,
      });
      return NextResponse.json({ appointments });
    } catch (error) {
      logErrorWithCause("GET /api/appointments?phone=", error);
      return NextResponse.json(
        {
          appointments: [],
          error: error instanceof Error ? error.message : "Failed to fetch",
        },
        { status: 500 }
      );
    }
  }

  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!from || !to) {
    return NextResponse.json(
      {
        error: "validation",
        field: !from ? "from" : "to",
        message: "Missing required query params: from, to (or phone)",
      },
      { status: 400 }
    );
  }

  try {
    const appointments = await getAppointments(from, to);
    return NextResponse.json({ appointments });
  } catch (error) {
    logErrorWithCause("GET /api/appointments?from&to=", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to fetch",
      },
      { status: 500 }
    );
  }
}

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
      typeof startHourRaw === "string" ? Number(startHourRaw) : startHourRaw;

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
    logErrorWithCause("POST /api/appointments", err);
    return NextResponse.json(
      { booked: false, error: "Invalid request body" },
      { status: 400 }
    );
  }
}
