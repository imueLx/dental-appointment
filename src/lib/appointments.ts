import type { BookedSlot } from "@/lib/slots";
import { createServiceClient } from "@/lib/supabase/admin";

const BOOKED_SLOTS_TIMEOUT_MS = 2500;

export async function getBookedSlots(
  from: string,
  to: string
): Promise<BookedSlot[]> {
  try {
    const supabase = createServiceClient();

    // Query table directly — service role bypasses RLS; avoids view grant issues
    const query = supabase
      .from("appointments")
      .select("appointment_date, start_time")
      .eq("status", "confirmed")
      .gte("appointment_date", from)
      .lte("appointment_date", to);

    const { data, error } = await Promise.race([
      query,
      new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error(`Supabase timed out after ${BOOKED_SLOTS_TIMEOUT_MS}ms`)),
          BOOKED_SLOTS_TIMEOUT_MS
        );
      }),
    ]);

    if (error) {
      console.error("Failed to fetch booked slots:", error.message);
      return [];
    }

    return data ?? [];
  } catch (err) {
    console.error(
      "Failed to fetch booked slots:",
      err instanceof Error ? err.message : err
    );
    return [];
  }
}

export async function getAppointments(from: string, to: string) {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("appointments")
    .select("*")
    .gte("appointment_date", from)
    .lte("appointment_date", to)
    .neq("status", "cancelled")
    .order("appointment_date")
    .order("start_time");

  if (error) throw new Error(error.message);
  return data ?? [];
}
