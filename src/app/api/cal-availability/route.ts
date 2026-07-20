import { NextRequest, NextResponse } from "next/server";
import { getClinicTimeZone } from "@/lib/cal";
import {
  BOOKING_WINDOW_DAYS,
  getOpenSlotCountsForRange,
  isLocalAvailabilityConfigured,
  SLOT_HOURS,
} from "@/lib/local-availability";

/**
 * Fast month/range availability: local clinic hours − Supabase bookings.
 * Does not call Cal.com slots API (avoids PH → US latency).
 */
export async function GET(request: NextRequest) {
  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");
  const timeZone =
    request.nextUrl.searchParams.get("timeZone") ?? getClinicTimeZone();

  if (
    !from ||
    !to ||
    !/^\d{4}-\d{2}-\d{2}$/.test(from) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(to)
  ) {
    return NextResponse.json(
      { error: "Missing or invalid from/to (YYYY-MM-DD)" },
      { status: 400 }
    );
  }

  if (!isLocalAvailabilityConfigured()) {
    return NextResponse.json({
      from,
      to,
      dates: {},
      configured: false,
      bookingWindowDays: BOOKING_WINDOW_DAYS,
      timeZone,
    });
  }

  const dates = await getOpenSlotCountsForRange(from, to);

  return NextResponse.json({
    from,
    to,
    dates,
    allSlotHours: [...SLOT_HOURS],
    configured: true,
    bookingWindowDays: BOOKING_WINDOW_DAYS,
    timeZone,
  });
}
