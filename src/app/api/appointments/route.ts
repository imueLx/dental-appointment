import { NextRequest, NextResponse } from "next/server";
import { getAppointments } from "@/lib/appointments";
import { createServiceClient } from "@/lib/supabase/admin";
import { bookingSchema, bookingToDbRow } from "@/lib/validators";
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
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!from || !to) {
    return NextResponse.json(
      { error: "Missing required query params: from, to" },
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

    const parsed = bookingSchema.safeParse({
      ...body,
      startHour,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid data" },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();
    const row = bookingToDbRow(parsed.data);

    const { data, error } = await supabase
      .from("appointments")
      .insert(row)
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "Slot already booked" },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ appointment: data }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}
