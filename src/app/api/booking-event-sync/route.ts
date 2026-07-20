import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/admin";
import { sendBookingConfirmationEmail } from "@/lib/email";
import { parseTimeToHour } from "@/lib/slots";

const bodySchema = z.object({
  bookingUid: z.string().min(1),
  action: z.enum(["confirm", "cancel"]),
});

function verifyApiKey(request: NextRequest): boolean {
  const secret = process.env.APPOINTMENT_API_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function POST(request: NextRequest) {
  if (!verifyApiKey(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid body" },
      { status: 400 }
    );
  }

  const { bookingUid, action } = parsed.data;
  const supabase = createServiceClient();

  if (action === "cancel") {
    const { error } = await supabase
      .from("appointments")
      .update({ status: "cancelled" })
      .eq("cal_booking_uid", bookingUid)
      .neq("status", "cancelled");

    if (error) {
      return NextResponse.json(
        { error: error.message ?? "Failed to cancel" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  }

  // action === "confirm"
  const { data: appointment, error } = await supabase
    .from("appointments")
    .select("patient_email,patient_name,appointment_date,start_time,status")
    .eq("cal_booking_uid", bookingUid)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: error.message ?? "Failed to fetch appointment" },
      { status: 500 }
    );
  }

  if (!appointment || appointment.status === "cancelled") {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const patientEmail = appointment.patient_email ?? "";
  if (!patientEmail.trim()) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const startHour = parseTimeToHour(appointment.start_time);
  if (!Number.isFinite(startHour)) {
    return NextResponse.json(
      { error: "Invalid start time for appointment" },
      { status: 400 }
    );
  }

  const result = await sendBookingConfirmationEmail({
    patientEmail,
    patientName: appointment.patient_name ?? undefined,
    appointmentDate: appointment.appointment_date,
    startHour,
  });

  // We still return ok even if email was skipped/failed to avoid webhook retries.
  return NextResponse.json({ ok: true, email: result });
}

