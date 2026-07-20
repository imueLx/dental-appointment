import { addDays, format, parseISO } from "date-fns";
import { normalizeCalLink } from "@/lib/env";
import { CLINIC_TIMEZONE } from "@/lib/constants";
import { LUNCH_START, SLOT_HOURS } from "@/lib/slots";

export interface ParsedCalLink {
  username: string;
  eventTypeSlug: string;
}

export function parseCalLink(raw?: string): ParsedCalLink | null {
  if (!raw) return null;
  const normalized = normalizeCalLink(raw);
  const parts = normalized.split("/").filter(Boolean);
  if (parts.length >= 2) {
    return {
      username: parts[0],
      eventTypeSlug: parts.slice(1).join("/"),
    };
  }
  return null;
}

export function getCalApiKey(): string | undefined {
  return process.env.CAL_API_KEY;
}

export function getClinicTimeZone(): string {
  return (
    process.env.CLINIC_TIMEZONE ??
    process.env.NEXT_PUBLIC_CLINIC_TIMEZONE ??
    CLINIC_TIMEZONE
  );
}

type CalSlotEntry = { start?: string; time?: string };

interface CalSlotResponse {
  data?: Record<string, CalSlotEntry[]>;
  status?: string;
}

export interface CalSlotsResult {
  ok: boolean;
  times: string[];
  error?: string;
}

/** Fetch available slot ISO times for a date from Cal.com v2 API */
export async function fetchCalAvailableSlots(
  parsed: ParsedCalLink,
  date: string,
  timeZone: string
): Promise<CalSlotsResult> {
  const endDate = format(addDays(parseISO(date), 1), "yyyy-MM-dd");
  const range = await fetchCalAvailableSlotsRange(
    parsed,
    date,
    endDate,
    timeZone
  );
  if (!range.ok) {
    return { ok: false, times: [], error: range.error };
  }
  return { ok: true, times: range.byDate[date] ?? [] };
}

/** Fetch available slots for a date range (end exclusive) from Cal.com v2 API */
export async function fetchCalAvailableSlotsRange(
  parsed: ParsedCalLink,
  startDate: string,
  endDate: string,
  timeZone: string
): Promise<CalSlotsResult & { byDate: Record<string, string[]> }> {
  const apiKey = getCalApiKey();
  if (!apiKey) {
    return { ok: false, times: [], byDate: {}, error: "CAL_API_KEY not set" };
  }

  const params = new URLSearchParams({
    username: parsed.username,
    eventTypeSlug: parsed.eventTypeSlug,
    start: startDate,
    end: endDate,
    timeZone,
    duration: "60",
  });

  const res = await fetch(`https://api.cal.com/v2/slots?${params}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "cal-api-version": "2024-09-04",
    },
    next: { revalidate: 15 },
  });

  if (!res.ok) {
    const body = await res.text();
    console.error("Cal.com slots API error:", res.status, body);
    return { ok: false, times: [], byDate: {}, error: `Cal API ${res.status}` };
  }

  const json = (await res.json()) as CalSlotResponse;
  const data = json.data ?? {};
  const byDate: Record<string, string[]> = {};

  for (const [day, daySlots] of Object.entries(data)) {
    byDate[day] = daySlots
      .map((s) => s.start ?? s.time ?? "")
      .filter(Boolean);
  }

  const times = byDate[startDate] ?? [];
  return { ok: true, times, byDate };
}

/**
 * Hour from Cal slot ISO string in the clinic timezone.
 * Uses wall-clock hour from the offset string (e.g. T09:00:00.000+08:00 → 9).
 */
export function hourFromCalSlot(iso: string): number | null {
  const match = iso.match(/T(\d{2}):/);
  if (match) return parseInt(match[1], 10);
  const h = new Date(iso).getHours();
  return Number.isNaN(h) ? null : h;
}

export function availableHoursFromIsoTimes(isoTimes: string[]): Set<number> {
  const hours = new Set<number>();
  for (const iso of isoTimes) {
    const hour = hourFromCalSlot(iso);
    if (
      hour !== null &&
      (SLOT_HOURS as readonly number[]).includes(hour) &&
      hour !== LUNCH_START
    ) {
      hours.add(hour);
    }
  }
  return hours;
}

/** Map slot start hour → Cal.com ISO time for deep-linking */
export function isoTimesByHour(isoTimes: string[]): Map<number, string> {
  const map = new Map<number, string>();
  for (const iso of isoTimes) {
    const hour = hourFromCalSlot(iso);
    if (
      hour !== null &&
      (SLOT_HOURS as readonly number[]).includes(hour) &&
      hour !== LUNCH_START
    ) {
      map.set(hour, iso);
    }
  }
  return map;
}

export function buildBookingStartIso(
  date: string,
  hour: number,
  timeZone: string = getClinicTimeZone()
): string {
  const hh = hour.toString().padStart(2, "0");
  if (timeZone === "Asia/Manila") {
    return `${date}T${hh}:00:00+08:00`;
  }
  return `${date}T${hh}:00:00`;
}

export interface CreateCalBookingParams {
  start: string;
  name: string;
  email: string;
  clinicCalValue: string;
  /** Physical address shown as the Cal.com meeting location (not Google Meet). */
  clinicAddress?: string;
  phone?: string;
  timeZone?: string;
  metadata?: Record<string, string>;
  bookingFieldsResponses?: Record<string, string>;
}

/** Cal.com custom booking fields required by your event type. */
export function buildCalBookingFieldResponses(
  clinicCalValue: string,
  extra?: Record<string, string>
): Record<string, string> {
  const fromEnv = process.env.CAL_BOOKING_FIELDS;
  let envFields: Record<string, string> = {};
  if (fromEnv) {
    try {
      envFields = JSON.parse(fromEnv) as Record<string, string>;
    } catch {
      console.warn("CAL_BOOKING_FIELDS is not valid JSON — ignoring");
    }
  }

  return {
    "Clinic-Address": clinicCalValue,
    ...envFields,
    ...extra,
  };
}

/**
 * Prefer in-person clinic address over Google Meet / Cal Video.
 * Requires the Cal.com event type to allow Address / Attendee address
 * (or “Somewhere else”) — not Google Meet only.
 */
function buildCalBookingLocation(clinicAddress?: string) {
  const address = clinicAddress?.trim();
  if (address) {
    return {
      type: "attendeeAddress" as const,
      address,
    };
  }
  return { type: "address" as const };
}

export interface CalBookingResult {
  ok: boolean;
  uid?: string;
  error?: string;
}

/** Create a booking on Cal.com (syncs your Cal calendar). */
export async function createCalBooking(
  parsed: ParsedCalLink,
  params: CreateCalBookingParams
): Promise<CalBookingResult> {
  const apiKey = getCalApiKey();
  if (!apiKey) {
    return { ok: false, error: "CAL_API_KEY not set" };
  }

  const res = await fetch("https://api.cal.com/v2/bookings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "cal-api-version": "2024-08-13",
    },
    body: JSON.stringify({
      username: parsed.username,
      eventTypeSlug: parsed.eventTypeSlug,
      start: params.start,
      attendee: {
        name: params.name,
        email: params.email,
        timeZone: params.timeZone ?? getClinicTimeZone(),
        ...(params.phone ? { phoneNumber: params.phone } : {}),
      },
      location: buildCalBookingLocation(params.clinicAddress),
      bookingFieldsResponses: buildCalBookingFieldResponses(
        params.clinicCalValue,
        params.bookingFieldsResponses
      ),
      metadata: params.metadata ?? {},
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error("Cal.com create booking error:", res.status, body);
    let message =
      "This time is no longer available on our calendar. Please choose another slot.";
    try {
      const json = JSON.parse(body) as {
        error?: { message?: string };
      };
      const calMessage = json.error?.message;
      if (calMessage?.includes("Missing required booking field")) {
        message =
          "Calendar setup issue — a required booking field is missing. Please contact the clinic.";
      } else if (
        calMessage?.includes("Invalid option") ||
        calMessage?.toLowerCase().includes("location")
      ) {
        message =
          "Calendar location mismatch — enable In-person / Address on the Cal.com event type (not Google Meet only).";
      } else if (calMessage) {
        message = calMessage;
      }
    } catch {
      // use default message
    }
    return { ok: false, error: message };
  }

  try {
    const json = (await res.json()) as {
      data?: { uid?: string };
    };
    return { ok: true, uid: json.data?.uid };
  } catch {
    return { ok: true };
  }
}

/** Cancel a booking on Cal.com by UID. */
export async function cancelCalBooking(
  uid: string,
  cancellationReason = "Cancelled via BrightSmile scheduler"
): Promise<{ ok: boolean; error?: string; alreadyCancelled?: boolean }> {
  const apiKey = getCalApiKey();
  if (!apiKey) {
    return { ok: false, error: "CAL_API_KEY not set" };
  }

  const res = await fetch(
    `https://api.cal.com/v2/bookings/${encodeURIComponent(uid)}/cancel`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "cal-api-version": "2024-08-13",
      },
      body: JSON.stringify({ cancellationReason }),
    }
  );

  if (res.ok) {
    return { ok: true };
  }

  const body = await res.text();
  console.error("Cal.com cancel booking error:", res.status, body);

  // Already cancelled / missing on Cal — treat as success so local DB can sync.
  if (res.status === 400 || res.status === 404) {
    const lower = body.toLowerCase();
    if (
      lower.includes("already") ||
      lower.includes("cancel") ||
      lower.includes("not found") ||
      lower.includes("404")
    ) {
      return { ok: true, alreadyCancelled: true };
    }
  }

  return { ok: false, error: `Cal cancel failed (${res.status})` };
}

/** Reschedule a booking on Cal.com by UID. Returns new booking UID if provided. */
export async function rescheduleCalBooking(
  uid: string,
  start: string,
  rescheduleReason = "Rescheduled via BrightSmile scheduler"
): Promise<CalBookingResult> {
  const apiKey = getCalApiKey();
  if (!apiKey) {
    return { ok: false, error: "CAL_API_KEY not set" };
  }

  const res = await fetch(
    `https://api.cal.com/v2/bookings/${encodeURIComponent(uid)}/reschedule`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "cal-api-version": "2024-08-13",
      },
      body: JSON.stringify({ start, rescheduleReason }),
    }
  );

  if (!res.ok) {
    const body = await res.text();
    console.error("Cal.com reschedule booking error:", res.status, body);
    let message = "Could not reschedule on calendar. Please choose another slot.";
    try {
      const json = JSON.parse(body) as { error?: { message?: string } };
      if (json.error?.message) message = json.error.message;
    } catch {
      // use default
    }
    return { ok: false, error: message };
  }

  try {
    const json = (await res.json()) as {
      data?: { uid?: string; rescheduledToUid?: string };
    };
    return {
      ok: true,
      uid: json.data?.rescheduledToUid ?? json.data?.uid,
    };
  } catch {
    return { ok: true };
  }
}

export const BOOKING_CONFIRMED_EVENT = "dental:booking-confirmed";

export function dispatchBookingConfirmed() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(BOOKING_CONFIRMED_EVENT));
  }
}
