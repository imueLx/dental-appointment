import { NextRequest, NextResponse } from "next/server";
import {
  availableHoursFromIsoTimes,
  fetchCalAvailableSlots,
  getCalApiKey,
  getClinicTimeZone,
  isoTimesByHour,
  parseCalLink,
} from "@/lib/cal";
import { getBookedSlots } from "@/lib/appointments";
import { getCalLink } from "@/lib/env";
import { parseTimeToHour, SLOT_HOURS } from "@/lib/slots";

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

  const calLink = getCalLink();
  const parsed = parseCalLink(calLink);

  if (!parsed) {
    return NextResponse.json(
      { error: "NEXT_PUBLIC_CAL_LINK not configured" },
      { status: 503 }
    );
  }

  if (!getCalApiKey()) {
    return NextResponse.json({
      date,
      availableHours: [],
      allSlotHours: [...SLOT_HOURS],
      configured: false,
      timeZone,
    });
  }

  const result = await fetchCalAvailableSlots(parsed, date, timeZone);

  if (!result.ok) {
    return NextResponse.json({
      date,
      availableHours: [],
      allSlotHours: [...SLOT_HOURS],
      configured: true,
      apiError: result.error,
      timeZone,
    });
  }

  const availableHours = [...availableHoursFromIsoTimes(result.times)];
  const slotTimes = Object.fromEntries(isoTimesByHour(result.times));

  const booked = await getBookedSlots(date, date);
  const bookedHours = new Set(
    booked.map((slot) => parseTimeToHour(slot.start_time))
  );
  const openHours = availableHours.filter((hour) => !bookedHours.has(hour));
  const openSlotTimes = Object.fromEntries(
    Object.entries(slotTimes).filter(([hour]) => !bookedHours.has(Number(hour)))
  );

  return NextResponse.json({
    date,
    availableHours: openHours,
    slotTimes: openSlotTimes,
    allSlotHours: [...SLOT_HOURS],
    configured: true,
    timeZone,
  });
}
