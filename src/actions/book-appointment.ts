"use server";

import { revalidatePath } from "next/cache";
import {
  createAppointment,
  type CreateAppointmentResult,
} from "@/lib/appointment-service";
import type { BookingFormData } from "@/lib/validators";

export type BookAppointmentResult = CreateAppointmentResult;

export async function bookAppointment(
  data: BookingFormData,
  options?: { slotIso?: string }
): Promise<BookAppointmentResult> {
  const result = await createAppointment(data, options);
  if (result.success) {
    revalidatePath("/book");
  }
  return result;
}
