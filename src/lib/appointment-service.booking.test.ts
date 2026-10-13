import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockFrom,
  mockCreateCalBooking,
  mockCancelCalBooking,
  mockGetBookedSlots,
  mockCreateServiceClient,
} = vi.hoisted(() => {
  const mockFrom = vi.fn();
  return {
    mockFrom,
    mockCreateCalBooking: vi.fn(),
    mockCancelCalBooking: vi.fn(),
    mockGetBookedSlots: vi.fn(),
    mockCreateServiceClient: vi.fn(() => ({ from: mockFrom })),
  };
});

vi.mock("@/lib/supabase/admin", () => ({
  createServiceClient: mockCreateServiceClient,
}));

vi.mock("@/lib/cal", async () => {
  const actual = await vi.importActual<typeof import("@/lib/cal")>("@/lib/cal");
  return {
    ...actual,
    createCalBooking: mockCreateCalBooking,
    cancelCalBooking: mockCancelCalBooking,
    getCalApiKey: () => "cal_test_key",
    parseCalLink: () => ({ username: "clinic", eventTypeSlug: "consult" }),
  };
});

vi.mock("@/lib/env", async () => {
  const actual = await vi.importActual<typeof import("@/lib/env")>("@/lib/env");
  return {
    ...actual,
    getCalLink: () => "clinic/consult",
    getSupabaseUrl: () => "https://example.supabase.co",
    getSupabaseServiceKey: () => "service_role_test",
    getSupabaseUrlError: () => null,
  };
});

vi.mock("@/lib/appointments", () => ({
  getBookedSlots: mockGetBookedSlots,
}));

import { createAppointment } from "@/lib/appointment-service";

const bookingInput = {
  appointmentDate: "2026-10-22",
  startHour: 10,
  clinicLocationId: "sm-southmall" as const,
  patientName: "test-dev",
  patientPhone: "9280815060",
  patientEmail: "",
  service: "Dental Cleaning" as const,
};

const slotIso = "2026-10-22T10:00:00+08:00";

type Row = Record<string, unknown>;

function chain(result: { data: unknown; error: unknown }) {
  const api: Record<string, unknown> = {};
  const self = () => api;
  for (const m of [
    "select",
    "eq",
    "in",
    "or",
    "neq",
    "gte",
    "lte",
    "order",
    "limit",
    "update",
    "insert",
    "delete",
  ]) {
    api[m] = vi.fn(self);
  }
  api.maybeSingle = vi.fn(async () => result);
  api.single = vi.fn(async () => result);
  (api as { then: unknown }).then = (
    onFulfilled: (v: typeof result) => unknown,
    onRejected?: (e: unknown) => unknown
  ) => Promise.resolve(result).then(onFulfilled, onRejected);
  return api;
}

describe("createAppointment idempotency + rollback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetBookedSlots.mockResolvedValue([]);
    mockCancelCalBooking.mockResolvedValue({ ok: true });
    process.env.CAL_API_KEY = "cal_test_key";
  });

  it("first book -> success (201 semantics)", async () => {
    const pending: Row = {
      id: "appt-1",
      appointment_date: "2026-10-22",
      start_time: "10:00:00",
      patient_name: "test-dev",
      patient_email: "",
      patient_phone: "9280815060",
      service: "Dental Cleaning",
      notes: "Branch: SM Southmall BrightSmile",
      status: "pending",
      cal_booking_uid: null,
      clinic_location_id: "sm-southmall",
      idempotency_key: "key",
      created_at: "2026-10-13T00:00:00Z",
    };
    const confirmed = {
      ...pending,
      status: "confirmed",
      cal_booking_uid: "cal-uid-1",
    };

    let call = 0;
    mockFrom.mockImplementation((table: string) => {
      expect(table).toBe("appointments");
      call += 1;
      // 1: byKey lookup
      if (call === 1) return chain({ data: null, error: null });
      // 2: slot holders
      if (call === 2) {
        const c = chain({ data: [], error: null });
        // .in(). returns then awaited? actually we don't call single - we await the query builder
        // Supabase query is thenable in real client; our code awaits `{ data, error }` from builder
        // Looking at code: `const { data: slotHolders, error: slotError } = await supabase.from(...).select(...).eq(...).eq(...).in(...)`
        // So the chain itself must be thenable!
        return makeThenable({ data: [], error: null }, c);
      }
      // 3: insert pending
      if (call === 3) return chain({ data: pending, error: null });
      // 4: confirm update
      if (call === 4) return chain({ data: confirmed, error: null });
      return chain({ data: null, error: null });
    });

    mockCreateCalBooking.mockResolvedValue({ ok: true, uid: "cal-uid-1" });

    const result = await createAppointment(bookingInput, { slotIso });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.duplicate).toBeFalsy();
      expect(result.id).toBe("appt-1");
      expect(result.calBookingUid).toBe("cal-uid-1");
      expect(result.appointment.patientName).toBe("test-dev");
    }
    expect(mockCreateCalBooking).toHaveBeenCalledOnce();
  });

  it("same request again -> duplicate success", async () => {
    const existing: Row = {
      id: "appt-1",
      appointment_date: "2026-10-22",
      start_time: "10:00:00",
      patient_name: "test-dev",
      patient_email: "",
      patient_phone: "9280815060",
      service: "Dental Cleaning",
      notes: "Branch: SM Southmall BrightSmile",
      status: "confirmed",
      cal_booking_uid: "cal-uid-1",
      clinic_location_id: "sm-southmall",
      idempotency_key: "abc",
      created_at: "2026-10-13T00:00:00Z",
    };

    mockFrom.mockImplementation(() =>
      chain({ data: existing, error: null })
    );

    const result = await createAppointment(bookingInput, { slotIso });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.duplicate).toBe(true);
      expect(result.id).toBe("appt-1");
    }
    expect(mockCreateCalBooking).not.toHaveBeenCalled();
  });

  it("different patient same slot -> slot_taken", async () => {
    const other: Row = {
      id: "appt-other",
      appointment_date: "2026-10-22",
      start_time: "10:00:00",
      patient_name: "Someone Else",
      patient_email: "",
      patient_phone: "9171234567",
      service: "Dental Cleaning",
      notes: "Branch: SM Southmall BrightSmile",
      status: "confirmed",
      cal_booking_uid: "cal-other",
      clinic_location_id: "sm-southmall",
      idempotency_key: "other-key",
      created_at: "2026-10-13T00:00:00Z",
    };

    let call = 0;
    mockFrom.mockImplementation(() => {
      call += 1;
      if (call === 1) return chain({ data: null, error: null });
      if (call === 2) return makeThenable({ data: [other], error: null });
      return chain({ data: null, error: null });
    });

    const result = await createAppointment(bookingInput, { slotIso });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe("slot_taken");
      expect(result.httpStatus).toBe(409);
      expect(result.error).toBe("slot_taken");
    }
    expect(mockCreateCalBooking).not.toHaveBeenCalled();
  });

  it("DB confirm failure after calendar create -> calendar rolled back", async () => {
    const pending: Row = {
      id: "appt-1",
      appointment_date: "2026-10-22",
      start_time: "10:00:00",
      patient_name: "test-dev",
      patient_email: "",
      patient_phone: "9280815060",
      service: "Dental Cleaning",
      notes: "Branch: SM Southmall BrightSmile",
      status: "pending",
      cal_booking_uid: null,
      clinic_location_id: "sm-southmall",
      idempotency_key: "key",
      created_at: "2026-10-13T00:00:00Z",
    };

    let call = 0;
    mockFrom.mockImplementation(() => {
      call += 1;
      if (call === 1) return chain({ data: null, error: null });
      if (call === 2) return makeThenable({ data: [], error: null });
      if (call === 3) return chain({ data: pending, error: null });
      // confirm update fails
      if (call === 4)
        return chain({ data: null, error: { message: "update failed" } });
      // delete pending after rollback
      if (call === 5) return makeThenable({ data: null, error: null });
      return chain({ data: null, error: null });
    });

    mockCreateCalBooking.mockResolvedValue({ ok: true, uid: "cal-uid-orphan" });
    mockCancelCalBooking.mockResolvedValue({ ok: true });

    const result = await createAppointment(bookingInput, { slotIso });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.httpStatus).toBe(500);
    }
    expect(mockCancelCalBooking).toHaveBeenCalledWith(
      "cal-uid-orphan",
      expect.any(String)
    );
  });
});

function makeThenable<T extends { data: unknown; error: unknown }>(
  result: T,
  base?: Record<string, unknown>
) {
  const api = base ?? chain(result);
  // Make the builder awaitable (supabase returns a PromiseLike)
  (api as { then?: unknown }).then = (
    onFulfilled: (v: T) => unknown,
    onRejected?: (e: unknown) => unknown
  ) => Promise.resolve(result).then(onFulfilled, onRejected);
  return api;
}
