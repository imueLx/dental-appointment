import { NextResponse } from "next/server";
import type {
  AppointmentActionResult,
  CreateAppointmentResult,
  PublicAppointment,
} from "@/lib/appointment-service";
import { toPublicAppointment, type AppointmentRow } from "@/lib/appointment-service";

export function bookResultToResponse(result: CreateAppointmentResult) {
  if (!result.success) {
    const body: Record<string, unknown> = {
      booked: false,
      error: result.error,
    };
    if (result.code === "validation" && result.field) {
      body.error = "validation";
      body.field = result.field;
      body.message = result.error;
    }
    if (result.code === "slot_taken") {
      body.error = "slot_taken";
    }
    if (result.calendarBookingId) {
      body.calendarBookingId = result.calendarBookingId;
    }
    return NextResponse.json(body, { status: result.httpStatus });
  }

  const status = result.duplicate ? 200 : 201;
  return NextResponse.json(
    {
      booked: true,
      ...(result.duplicate ? { duplicate: true } : {}),
      appointment: result.appointment,
      calSynced: result.calSynced,
      calBookingUid: result.calBookingUid,
      message: result.duplicate
        ? "Appointment already booked."
        : "Appointment booked successfully.",
    },
    { status }
  );
}

export function cancelResultToResponse(result: AppointmentActionResult) {
  if (!result.success) {
    const body: Record<string, unknown> = {
      cancelled: false,
      error: result.error,
    };
    if (result.code === "validation" && result.field) {
      body.error = "validation";
      body.field = result.field;
      body.message = result.error;
    }
    return NextResponse.json(body, { status: result.httpStatus });
  }

  return NextResponse.json({
    cancelled: true,
    ...(result.duplicate ? { duplicate: true } : {}),
    appointment: toPublicAppointment(result.appointment as AppointmentRow),
    message: "Appointment cancelled successfully.",
  });
}

export function rescheduleResultToResponse(result: AppointmentActionResult) {
  if (!result.success) {
    const body: Record<string, unknown> = {
      rescheduled: false,
      error: result.error,
    };
    if (result.code === "validation" && result.field) {
      body.error = "validation";
      body.field = result.field;
      body.message = result.error;
    }
    if (result.code === "slot_taken") {
      body.error = "slot_taken";
    }
    return NextResponse.json(body, { status: result.httpStatus });
  }

  return NextResponse.json({
    rescheduled: true,
    appointment: toPublicAppointment(result.appointment as AppointmentRow),
    message: "Appointment rescheduled successfully.",
  });
}

export type { PublicAppointment };
