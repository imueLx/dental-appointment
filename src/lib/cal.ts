import { addDays, format, parseISO } from "date-fns";
import { normalizeCalLink } from "@/lib/env";
import { CLINIC_TIMEZONE } from "@/lib/constants";
import {
  normalizePhMobile,
  phoneLookupSuffix,
  toPhE164,
} from "@/lib/phone";
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
  /** Set when Cal rejects because the slot/attendee is already booked. */
  code?: "already_booked";
}

export function isCalAlreadyBookedMessage(message: string | undefined): boolean {
  if (!message) return false;
  return /already has booking|already booked|not available/i.test(message);
}

/** Compare two slot ISO strings (ignore ms / equivalent instants). */
export function slotInstantsEqual(a: string, b: string): boolean {
  const ta = Date.parse(a);
  const tb = Date.parse(b);
  if (Number.isFinite(ta) && Number.isFinite(tb)) {
    return Math.abs(ta - tb) < 60_000;
  }
  return (
    a.replace(/\.\d{3}/, "").replace(/Z$/, "+00:00") ===
    b.replace(/\.\d{3}/, "").replace(/Z$/, "+00:00")
  );
}

/** Wall-clock date YYYY-MM-DD in clinic TZ from a booking start ISO. */
export function dateKeyFromSlotIso(
  iso: string,
  timeZone: string = getClinicTimeZone()
): string | null {
  try {
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return fmt.format(new Date(iso));
  } catch {
    const m = iso.match(/^(\d{4}-\d{2}-\d{2})/);
    return m?.[1] ?? null;
  }
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

  try {
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
      return {
        ok: false,
        error: message,
        ...(isCalAlreadyBookedMessage(message)
          ? { code: "already_booked" as const }
          : {}),
      };
    }

    try {
      const json = (await res.json()) as {
        data?: { uid?: string };
      };
      return { ok: true, uid: json.data?.uid };
    } catch {
      return { ok: true };
    }
  } catch (err) {
    const cause = err instanceof Error ? (err as Error & { cause?: unknown }).cause : undefined;
    console.error("Cal.com create booking fetch failed:", {
      message: err instanceof Error ? err.message : String(err),
      cause:
        cause instanceof Error
          ? { name: cause.name, message: cause.message, code: (cause as NodeJS.ErrnoException).code }
          : cause,
    });
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Calendar request failed",
    };
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
  reschedulingReason = "Rescheduled via BrightSmile scheduler"
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
      body: JSON.stringify({ start, reschedulingReason }),
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

export type CalListedBooking = {
  uid: string;
  title?: string;
  status?: string;
  start?: string;
  attendeeName?: string;
  attendeeEmail?: string;
  attendeePhone?: string;
  metadata?: Record<string, string>;
};

export type ListCalBookingsOptions = {
  status?: string;
  take?: number;
  afterStart?: string;
  beforeEnd?: string;
  attendeeEmail?: string;
  attendeeName?: string;
};

/** List Cal.com bookings (orphan cleanup, slot exclusion, phone reconcile). */
export async function listCalBookings(
  options?: ListCalBookingsOptions
): Promise<{ ok: boolean; bookings: CalListedBooking[]; error?: string }> {
  const apiKey = getCalApiKey();
  if (!apiKey) {
    return { ok: false, bookings: [], error: "CAL_API_KEY not set" };
  }

  const params = new URLSearchParams();
  if (options?.status) params.set("status", options.status);
  params.set("take", String(options?.take ?? 100));
  if (options?.afterStart) params.set("afterStart", options.afterStart);
  if (options?.beforeEnd) params.set("beforeEnd", options.beforeEnd);
  if (options?.attendeeEmail) params.set("attendeeEmail", options.attendeeEmail);
  if (options?.attendeeName) params.set("attendeeName", options.attendeeName);

  try {
    const res = await fetch(`https://api.cal.com/v2/bookings?${params}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "cal-api-version": "2024-08-13",
      },
    });

    if (!res.ok) {
      const body = await res.text();
      console.error("Cal.com list bookings error:", res.status, body);
      return { ok: false, bookings: [], error: `Cal API ${res.status}` };
    }

    const json = (await res.json()) as {
      data?: Array<{
        uid?: string;
        title?: string;
        status?: string;
        start?: string;
        startTime?: string;
        metadata?: Record<string, string>;
        attendees?: Array<{
          name?: string;
          email?: string;
          phoneNumber?: string;
        }>;
      }>;
    };

    const bookings: CalListedBooking[] = (json.data ?? [])
      .filter((b): b is typeof b & { uid: string } => Boolean(b.uid))
      .map((b) => ({
        uid: b.uid,
        title: b.title,
        status: b.status,
        start: b.start ?? b.startTime,
        attendeeName: b.attendees?.[0]?.name,
        attendeeEmail: b.attendees?.[0]?.email,
        attendeePhone: b.attendees?.[0]?.phoneNumber,
        metadata: b.metadata,
      }));

    return { ok: true, bookings };
  } catch (err) {
    const cause = err instanceof Error ? (err as Error & { cause?: unknown }).cause : undefined;
    console.error("Cal.com list bookings fetch failed:", {
      message: err instanceof Error ? err.message : String(err),
      cause:
        cause instanceof Error
          ? { name: cause.name, message: cause.message, code: (cause as NodeJS.ErrnoException).code }
          : cause,
    });
    return {
      ok: false,
      bookings: [],
      error: err instanceof Error ? err.message : "Cal list fetch failed",
    };
  }
}

function phonesMatch(
  a: string | undefined,
  b: string | undefined
): boolean {
  if (!a || !b) return false;
  const sa = phoneLookupSuffix(a);
  const sb = phoneLookupSuffix(b);
  return Boolean(sa && sb && sa === sb);
}

export function calBookingMatchesAttendee(
  booking: CalListedBooking,
  attendee: { phone?: string; name?: string; email?: string }
): boolean {
  if (attendee.phone && phonesMatch(booking.attendeePhone, attendee.phone)) {
    return true;
  }
  if (
    attendee.email &&
    booking.attendeeEmail &&
    booking.attendeeEmail.toLowerCase() === attendee.email.toLowerCase()
  ) {
    return true;
  }
  // Synthetic emails used when patientEmail is empty: booking+9XXXXXXXXX@...
  if (attendee.phone && booking.attendeeEmail) {
    const digits = normalizePhMobile(attendee.phone);
    if (
      digits &&
      booking.attendeeEmail.toLowerCase().includes(`booking+${digits}@`)
    ) {
      return true;
    }
  }
  if (
    attendee.name &&
    booking.attendeeName &&
    booking.attendeeName.trim().toLowerCase() ===
      attendee.name.trim().toLowerCase()
  ) {
    return true;
  }
  return false;
}

/**
 * Find a Cal booking at the given slot. Prefers same-attendee match;
 * otherwise returns any booking occupying the slot.
 */
export async function findCalBookingAtSlot(
  slotIso: string,
  attendee?: { phone?: string; name?: string; email?: string }
): Promise<{
  booking: CalListedBooking | null;
  samePatient: boolean;
}> {
  const dateKey = dateKeyFromSlotIso(slotIso);
  const dayStart = dateKey
    ? new Date(`${dateKey}T00:00:00+08:00`).toISOString()
    : new Date(Date.parse(slotIso) - 12 * 3600_000).toISOString();
  const dayEnd = dateKey
    ? new Date(`${dateKey}T23:59:59.999+08:00`).toISOString()
    : new Date(Date.parse(slotIso) + 12 * 3600_000).toISOString();

  const listed = await listCalBookings({
    status: "upcoming",
    afterStart: dayStart,
    beforeEnd: dayEnd,
    take: 100,
  });

  if (!listed.ok) {
    return { booking: null, samePatient: false };
  }

  const atSlot = listed.bookings.filter(
    (b) => b.start && slotInstantsEqual(b.start, slotIso)
  );

  if (!atSlot.length) {
    return { booking: null, samePatient: false };
  }

  if (attendee) {
    const mine = atSlot.find((b) => calBookingMatchesAttendee(b, attendee));
    if (mine) return { booking: mine, samePatient: true };
  }

  return { booking: atSlot[0], samePatient: false };
}

/** Booked start hours on Cal.com for a clinic date (Asia/Manila wall clock). */
export async function getCalBookedHoursForDate(
  date: string
): Promise<number[]> {
  const dayStart = new Date(`${date}T00:00:00+08:00`).toISOString();
  const dayEnd = new Date(`${date}T23:59:59.999+08:00`).toISOString();

  const listed = await listCalBookings({
    status: "upcoming",
    afterStart: dayStart,
    beforeEnd: dayEnd,
    take: 100,
  });

  if (!listed.ok) return [];

  const hours = new Set<number>();
  for (const b of listed.bookings) {
    if (!b.start) continue;
    if (dateKeyFromSlotIso(b.start) !== date) continue;
    const hour = hourFromCalSlot(b.start);
    if (hour !== null && (SLOT_HOURS as readonly number[]).includes(hour)) {
      hours.add(hour);
    }
  }
  return [...hours];
}

/** Upcoming Cal bookings that appear to belong to this PH mobile. */
export async function findCalBookingsForPhone(
  phone: string
): Promise<CalListedBooking[]> {
  const normalized = normalizePhMobile(phone);
  const suffix = phoneLookupSuffix(phone);
  if (!normalized && !suffix) return [];

  const listed = await listCalBookings({ status: "upcoming", take: 100 });
  if (!listed.ok) return [];

  const e164 = toPhE164(phone);
  const synthetic = normalized
    ? `booking+${normalized}@bookings.brightsmile.ph`
    : null;

  return listed.bookings.filter((b) => {
    if (
      calBookingMatchesAttendee(b, {
        phone: e164,
        email: synthetic ?? undefined,
      })
    ) {
      return true;
    }
    if (suffix && b.attendeeEmail?.includes(`booking+${suffix}@`)) return true;
    if (
      suffix &&
      b.attendeePhone &&
      phoneLookupSuffix(b.attendeePhone) === suffix
    ) {
      return true;
    }
    return false;
  });
}

export const BOOKING_CONFIRMED_EVENT = "dental:booking-confirmed";

export function dispatchBookingConfirmed() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(BOOKING_CONFIRMED_EVENT));
  }
}
