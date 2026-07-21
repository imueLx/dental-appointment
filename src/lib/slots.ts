import {
  addDays,
  format,
  isAfter,
  isBefore,
  isWeekend,
  parseISO,
  startOfDay,
  startOfWeek,
} from "date-fns";

/** Bookable start hours: 8–11 AM, then 1–4 PM (lunch 12–1 PM, last slot ends at 5 PM) */
export const SLOT_HOURS = [8, 9, 10, 11, 13, 14, 15, 16] as const;
/** Lunch block 12:00 PM – 1:00 PM (hour 12 unavailable) */
export const LUNCH_START = 12;
export const LUNCH_END = 13;
export const LUNCH_HOUR = LUNCH_START;
export const CLINIC_OPEN = 8;
export const CLINIC_CLOSE = 17;
export const APPOINTMENT_DURATION_MINUTES = 60;
export const PATIENTS_PER_SLOT = 1;
/** How far ahead patients can book (from today). */
export const BOOKING_WINDOW_DAYS = 30;

export type SlotHour = (typeof SLOT_HOURS)[number];

export type ScheduleGridRow =
  | { type: "slot"; hour: number }
  | { type: "lunch" };

export interface BookedSlot {
  appointment_date: string;
  start_time: string;
}

export function getScheduleGridRows(): ScheduleGridRow[] {
  const before = SLOT_HOURS.filter((h) => h < LUNCH_START);
  const after = SLOT_HOURS.filter((h) => h >= LUNCH_END);
  return [
    ...before.map((hour) => ({ type: "slot" as const, hour })),
    { type: "lunch" as const },
    ...after.map((hour) => ({ type: "slot" as const, hour })),
  ];
}

export function hourToTimeString(hour: number): string {
  return `${hour.toString().padStart(2, "0")}:00:00`;
}

/** Client-safe ISO start for booking (Asia/Manila uses +08:00). */
export function buildLocalSlotIso(
  date: string,
  hour: number,
  timeZone: string = "Asia/Manila"
): string {
  const hh = hour.toString().padStart(2, "0");
  if (timeZone === "Asia/Manila") {
    return `${date}T${hh}:00:00+08:00`;
  }
  return `${date}T${hh}:00:00`;
}

/** Open slot counts for each bookable day in [from, to] inclusive. */
export function openCountsForRange(
  from: string,
  to: string,
  bookedSlots: BookedSlot[],
  now: Date = new Date()
): Record<string, number> {
  const dates: Record<string, number> = {};
  const start = parseISO(`${from}T12:00:00`);
  const end = parseISO(`${to}T12:00:00`);
  for (let d = start; d.getTime() <= end.getTime(); d = addDays(d, 1)) {
    const key = formatDateKey(d);
    if (!isBookableCalendarDay(d, now)) continue;
    dates[key] = generateDaySlots(d).filter((hour) =>
      isSlotBookable(d, hour, bookedSlots)
    ).length;
  }
  return dates;
}

export function openHoursForDate(
  dateKey: string,
  bookedSlots: BookedSlot[],
  now: Date = new Date()
): number[] {
  const day = parseISO(`${dateKey}T12:00:00`);
  if (!isBookableCalendarDay(day, now)) return [];
  return generateDaySlots(day).filter((hour) =>
    isSlotBookable(day, hour, bookedSlots)
  );
}

export function parseTimeToHour(time: string): number {
  const [h] = time.split(":");
  return parseInt(h, 10);
}

export function formatSlotLabel(hour: number): string {
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${displayHour}:00 ${period}`;
}

/** Full hour block label, e.g. "8:00 AM – 9:00 AM" */
export function formatSlotRange(startHour: number): string {
  return `${formatSlotLabel(startHour)} – ${formatSlotLabel(startHour + 1)}`;
}

export function formatLunchLabel(): string {
  return "12:00 PM – 1:00 PM";
}

/** Earliest bookable calendar day (tomorrow, or next weekday). */
export function getBookingStartDate(from: Date = new Date()): Date {
  let d = addDays(startOfDay(from), 1);
  while (isWeekend(d)) {
    d = addDays(d, 1);
  }
  return d;
}

/** Last bookable calendar day (today + BOOKING_WINDOW_DAYS). */
export function getBookingEndDate(from: Date = new Date()): Date {
  return addDays(startOfDay(from), BOOKING_WINDOW_DAYS);
}

export function isAfterBookingEnd(date: Date, from: Date = new Date()): boolean {
  return isAfter(startOfDay(date), getBookingEndDate(from));
}

export function isBookableCalendarDay(
  date: Date,
  from: Date = new Date()
): boolean {
  if (isWeekend(date)) return false;
  if (isBeforeBookingStart(date, from)) return false;
  if (isAfterBookingEnd(date, from)) return false;
  return true;
}

/** First weekday on or after `from` with at least one open slot. */
export function findFirstAvailableDate(
  availability: Record<string, number>,
  from: Date = new Date()
): string {
  const start = getBookingStartDate(from);
  for (let i = 0; i < BOOKING_WINDOW_DAYS; i++) {
    const d = addDays(start, i);
    if (isWeekend(d)) continue;
    if (isAfterBookingEnd(d, from)) break;
    const key = formatDateKey(d);
    if ((availability[key] ?? 0) > 0) return key;
  }
  return formatDateKey(start);
}

export function isBeforeBookingStart(date: Date, from: Date = new Date()): boolean {
  return isBefore(startOfDay(date), getBookingStartDate(from));
}

export function formatDateKey(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function getWeekDates(anchorDate: Date): Date[] {
  const monday = startOfWeek(anchorDate, { weekStartsOn: 1 });
  return Array.from({ length: 5 }, (_, i) => addDays(monday, i));
}

export function generateDaySlots(date: Date): SlotHour[] {
  if (isWeekend(date)) return [];
  return [...SLOT_HOURS];
}

export function isSlotBooked(
  dateKey: string,
  hour: number,
  bookedSlots: BookedSlot[]
): boolean {
  return bookedSlots.some(
    (slot) =>
      slot.appointment_date === dateKey &&
      parseTimeToHour(slot.start_time) === hour
  );
}

export function isSlotInPast(date: Date, hour: number): boolean {
  const now = new Date();
  const slotDate = startOfDay(date);
  const today = startOfDay(now);

  if (isBefore(slotDate, today)) return true;
  if (formatDateKey(slotDate) !== formatDateKey(today)) return false;

  return hour <= now.getHours();
}

export function isSlotBookable(
  date: Date,
  hour: number,
  bookedSlots: BookedSlot[]
): boolean {
  if (isWeekend(date)) return false;
  if (hour >= LUNCH_START && hour < LUNCH_END) return false;
  if (!SLOT_HOURS.includes(hour as SlotHour)) return false;
  if (isSlotInPast(date, hour)) return false;
  if (isSlotBooked(formatDateKey(date), hour, bookedSlots)) return false;
  return true;
}

export function getWeekRange(dates: Date[]): { from: string; to: string } {
  const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime());
  return {
    from: formatDateKey(sorted[0]),
    to: formatDateKey(sorted[sorted.length - 1]),
  };
}

export function parseDateKey(dateKey: string): Date {
  return parseISO(dateKey);
}

/**
 * Normalize n8n/AI date inputs to YYYY-MM-DD.
 * Accepts plain dates, ISO datetimes, and values wrapped in quotes/whitespace.
 */
export function normalizeAppointmentDate(value: unknown): string | null {
  if (value == null) return null;
  let s = String(value).trim();
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim();
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const isoPrefix = s.match(/^(\d{4}-\d{2}-\d{2})(?:[T\s].*)?$/);
  return isoPrefix ? isoPrefix[1] : null;
}

/**
 * Prefer an explicit date; if missing/truncated (common LLM bug), derive from slotIso.
 */
export function resolveAppointmentDate(
  appointmentDate: unknown,
  slotIso?: unknown
): string | null {
  return (
    normalizeAppointmentDate(appointmentDate) ??
    normalizeAppointmentDate(slotIso)
  );
}

/** Coerce n8n/AI hour inputs (number or numeric string) to a finite number. */
export function normalizeStartHour(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value.trim().replace(/^["']|["']$/g, ""));
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}
