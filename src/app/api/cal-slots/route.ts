import { NextRequest, NextResponse } from "next/server";
import { getClinicTimeZone } from "@/lib/cal";
import {
  getOpenHoursForDate,
  isLocalAvailabilityConfigured,
  SLOT_HOURS,
} from "@/lib/local-availability";

/**
 * Availability for one date: clinic hours − Supabase − existing Cal.com bookings.
 * Keeps /book and chat availability aligned when orphans exist only on Cal.
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
