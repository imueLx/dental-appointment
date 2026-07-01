import type { BookedSlot } from "@/lib/slots";
import { createServiceClient } from "@/lib/supabase/admin";

export async function getBookedSlots(
  from: string,
  to: string
): Promise<BookedSlot[]> {
  const supabase = createServiceClient();

  // Query table directly — service role bypasses RLS; avoids view grant issues
  const { data, error } = await supabase
    .from("appointments")
    .select("appointment_date, start_time")
    .eq("status", "confirmed")
    .gte("appointment_date", from)
    .lte("appointment_date", to);

  if (error) {
    console.error("Failed to fetch booked slots:", error.message);
    return [];
  }

  return data ?? [];
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
