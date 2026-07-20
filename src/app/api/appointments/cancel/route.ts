import { NextRequest, NextResponse } from "next/server";
import { cancelAppointment } from "@/lib/appointment-service";

function verifyApiKey(request: NextRequest): boolean {
  const secret = process.env.APPOINTMENT_API_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

/**
 * POST /api/appointments/cancel
 * Body: { "id": "<appointment-uuid>" }
 *
 * Prefer this for n8n (id in JSON body) — more reliable than DELETE .../appointments/{id}.
 */
export async function POST(request: NextRequest) {
  if (!verifyApiKey(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { id?: unknown };
    const id = typeof body.id === "string" ? body.id.trim() : "";
    if (!id) {
      return NextResponse.json(
        { error: "Missing required field: id (appointment UUID)" },
        { status: 400 }
      );
    }

    const result = await cancelAppointment(id);

    if (!result.success) {
      const status = result.error === "Appointment not found" ? 404 : 400;
      return NextResponse.json({ error: result.error }, { status });
    }

    return NextResponse.json({
      appointment: result.appointment,
      cancelled: true,
      message: "Appointment cancelled successfully.",
    });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}
