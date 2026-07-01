import { NextRequest, NextResponse } from "next/server";
import {
  availableHoursFromIsoTimes,
  fetchCalAvailableSlotsRange,
  getCalApiKey,
  getClinicTimeZone,
  parseCalLink,
} from "@/lib/cal";
import { getBookedSlots } from "@/lib/appointments";
import { getCalLink } from "@/lib/env";
import {
  BOOKING_WINDOW_DAYS,
  formatDateKey,
  generateDaySlots,
  isBookableCalendarDay,
  isSlotBooked,
  isSlotInPast,
  SLOT_HOURS,
} from "@/lib/slots";
import { addDays, eachDayOfInterval, parseISO } from "date-fns";

export async function GET(request: NextRequest) {
  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");
  const timeZone =
    request.nextUrl.searchParams.get("timeZone") ?? getClinicTimeZone();

  if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return NextResponse.json(
      { error: "Missing or invalid from/to (YYYY-MM-DD)" },
      { status: 400 }
    );
  }

  const calLink = getCalLink();
  const parsed = parseCalLink(calLink);

  if (!parsed) {
    return NextResponse.json(
      { error: "NEXT_PUBLIC_CAL_LINK not configured" },
      { status: 503 }
    );
  }

  const dates: Record<string, number> = {};
  const rangeEnd = formatDateKey(addDays(parseISO(to), -1));
  const bookedSlots = await getBookedSlots(from, rangeEnd);

  if (!getCalApiKey()) {
    for (const day of eachDayOfInterval({
      start: parseISO(from),
      end: addDays(parseISO(to), -1),
    })) {
      const key = formatDateKey(day);
      if (!isBookableCalendarDay(day)) {
        continue;
      }
      dates[key] = generateDaySlots(day).filter(
        (hour) =>
          !isSlotInPast(day, hour) &&
          !isSlotBooked(key, hour, bookedSlots)
      ).length;
    }

    return NextResponse.json({
      from,
      to,
      dates,
      configured: false,
      bookingWindowDays: BOOKING_WINDOW_DAYS,
      timeZone,
    });
  }

  const result = await fetchCalAvailableSlotsRange(
    parsed,
    from,
    to,
    timeZone
  );

  if (!result.ok) {
    return NextResponse.json({
      from,
      to,
      dates,
      configured: true,
      apiError: result.error,
      timeZone,
    });
  }

  for (const day of eachDayOfInterval({
    start: parseISO(from),
    end: addDays(parseISO(to), -1),
  })) {
    const key = formatDateKey(day);
    if (!isBookableCalendarDay(day)) {
      continue;
    }
    const isoTimes = result.byDate[key] ?? [];
    const calHours = availableHoursFromIsoTimes(isoTimes);
    dates[key] = [...calHours].filter(
      (hour) => !isSlotBooked(key, hour, bookedSlots)
    ).length;
  }

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
