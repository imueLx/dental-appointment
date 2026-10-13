import { NextRequest, NextResponse } from "next/server";
import { cancelResultToResponse } from "@/lib/api-booking-response";
import { cancelAppointment } from "@/lib/appointment-service";
import { logErrorWithCause } from "@/lib/log-error";

function verifyApiKey(request: NextRequest): boolean {
  const secret = process.env.APPOINTMENT_API_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

/**
 * POST /api/appointments/cancel
 * Body: { "id": "<appointment-uuid>" }
 */
export async function POST(request: NextRequest) {
  if (!verifyApiKey(request)) {
    return NextResponse.json(
      { cancelled: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const body = (await request.json()) as { id?: unknown };
    const id = typeof body.id === "string" ? body.id.trim() : "";
    if (!id) {
      return NextResponse.json(
        {
          cancelled: false,
          error: "validation",
          field: "id",
          message: "Missing required field: id (appointment UUID)",
        },
        { status: 400 }
      );
    }

    const result = await cancelAppointment(id);
    return cancelResultToResponse(result);
  } catch (err) {
    logErrorWithCause("POST /api/appointments/cancel", err);
    return NextResponse.json(
      { cancelled: false, error: "Invalid request body" },
      { status: 400 }
    );
  }
}
