import { addDays, eachDayOfInterval, parseISO } from "date-fns";
import { buildBookingStartIso, getClinicTimeZone } from "@/lib/cal";
import { getBookedSlots } from "@/lib/appointments";
import { getSupabaseServiceKey, getSupabaseUrl } from "@/lib/env";
import {
  BOOKING_WINDOW_DAYS,
  formatDateKey,
  generateDaySlots,
  isBookableCalendarDay,
  isSlotBookable,
  SLOT_HOURS,
  type BookedSlot,
} from "@/lib/slots";

/** True when Supabase is configured — availability is served from local hours + DB. */
export function isLocalAvailabilityConfigured(): boolean {
  return Boolean(getSupabaseUrl() && getSupabaseServiceKey());
}

export function buildSlotTimesForHours(
  date: string,
  hours: number[],
  timeZone: string = getClinicTimeZone()
): Record<string, string> {
  return Object.fromEntries(
    hours.map((hour) => [String(hour), buildBookingStartIso(date, hour, timeZone)])
  );
}

/** Open clinic hours for one date (local rules − Supabase confirmed bookings). */
export async function getOpenHoursForDate(
  date: string,
  timeZone: string = getClinicTimeZone()
): Promise<{
  availableHours: number[];
  slotTimes: Record<string, string>;
  bookedSlots: BookedSlot[];
}> {
  const day = parseISO(`${date}T12:00:00`);
  if (!isBookableCalendarDay(day)) {
    return { availableHours: [], slotTimes: {}, bookedSlots: [] };
  }

  const bookedSlots = await getBookedSlots(date, date);
  const availableHours = generateDaySlots(day).filter((hour) =>
    isSlotBookable(day, hour, bookedSlots)
  );

  return {
    availableHours,
    slotTimes: buildSlotTimesForHours(date, availableHours, timeZone),
    bookedSlots,
  };
}

/** Open slot counts per day for [from, to) — end date exclusive (same as Cal API). */
export async function getOpenSlotCountsForRange(
  from: string,
  to: string
): Promise<Record<string, number>> {
  const dates: Record<string, number> = {};
  const rangeEnd = formatDateKey(addDays(parseISO(to), -1));
  const bookedSlots = await getBookedSlots(from, rangeEnd);

  for (const day of eachDayOfInterval({
    start: parseISO(from),
    end: addDays(parseISO(to), -1),
  })) {
    const key = formatDateKey(day);
    if (!isBookableCalendarDay(day)) continue;

    dates[key] = generateDaySlots(day).filter((hour) =>
      isSlotBookable(day, hour, bookedSlots)
    ).length;
  }

  return dates;
}

export { SLOT_HOURS, BOOKING_WINDOW_DAYS };
