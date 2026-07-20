import { NextRequest, NextResponse } from "next/server";
import { getClinicTimeZone } from "@/lib/cal";
import {
  getOpenHoursForDate,
  isLocalAvailabilityConfigured,
  SLOT_HOURS,
} from "@/lib/local-availability";

/**
 * Fast availability for one date: clinic hours − Supabase bookings.
 * Does not call Cal.com slots API (avoids PH → US latency).
 */
export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get("date");
  const timeZone =
    request.nextUrl.searchParams.get("timeZone") ?? getClinicTimeZone();

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: "Missing or invalid date (YYYY-MM-DD)" },
      { status: 400 }
    );
  }

  if (!isLocalAvailabilityConfigured()) {
    return NextResponse.json({
      date,
      availableHours: [],
      allSlotHours: [...SLOT_HOURS],
      configured: false,
      timeZone,
    });
  }

  const { availableHours, slotTimes } = await getOpenHoursForDate(date, timeZone);

  return NextResponse.json({
    date,
    availableHours,
    slotTimes,
    allSlotHours: [...SLOT_HOURS],
    configured: true,
    timeZone,
  });
}
