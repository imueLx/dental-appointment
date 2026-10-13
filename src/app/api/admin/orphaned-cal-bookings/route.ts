import { NextRequest, NextResponse } from "next/server";
import { cancelCalBooking, listCalBookings } from "@/lib/cal";
import { logErrorWithCause } from "@/lib/log-error";
import { createServiceClient } from "@/lib/supabase/admin";

function verifyApiKey(request: NextRequest): boolean {
  const secret = process.env.APPOINTMENT_API_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

/**
 * GET /api/admin/orphaned-cal-bookings
 * Lists Cal.com bookings that have no matching confirmed/pending DB row.
 *
 * DELETE /api/admin/orphaned-cal-bookings
 * Body: { uids?: string[], cancelAllOrphans?: boolean, nameContains?: string }
 * Cancels orphaned calendar bookings (does not touch DB).
 */
export async function GET(request: NextRequest) {
  if (!verifyApiKey(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const listed = await listCalBookings({ status: "upcoming", take: 100 });
    if (!listed.ok) {
      return NextResponse.json(
        { error: listed.error ?? "Failed to list Cal bookings" },
        { status: 500 }
      );
    }

    const supabase = createServiceClient();
    const uids = listed.bookings.map((b) => b.uid);
    const { data: rows, error } = await supabase
      .from("appointments")
      .select("id, cal_booking_uid, status, patient_name, appointment_date, start_time")
      .in("cal_booking_uid", uids.length ? uids : ["__none__"]);

    if (error) {
      logErrorWithCause("orphaned-cal-bookings: db lookup", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const known = new Set(
      (rows ?? [])
        .filter((r) => r.status === "confirmed" || r.status === "pending")
        .map((r) => r.cal_booking_uid)
        .filter(Boolean)
    );

    const orphans = listed.bookings.filter((b) => !known.has(b.uid));

    return NextResponse.json({
      orphans,
      count: orphans.length,
      checked: listed.bookings.length,
    });
  } catch (err) {
    logErrorWithCause("GET /api/admin/orphaned-cal-bookings", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  if (!verifyApiKey(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      uids?: string[];
      cancelAllOrphans?: boolean;
      nameContains?: string;
    };

    let uids = Array.isArray(body.uids)
      ? body.uids.filter((u) => typeof u === "string" && u.trim())
      : [];

    if (body.cancelAllOrphans || body.nameContains) {
      const listed = await listCalBookings({ status: "upcoming", take: 100 });
      if (!listed.ok) {
        return NextResponse.json(
          { error: listed.error ?? "Failed to list Cal bookings" },
          { status: 500 }
        );
      }

      const supabase = createServiceClient();
      const allUids = listed.bookings.map((b) => b.uid);
      const { data: rows } = await supabase
        .from("appointments")
        .select("cal_booking_uid, status")
        .in("cal_booking_uid", allUids.length ? allUids : ["__none__"]);

      const known = new Set(
        (rows ?? [])
          .filter((r) => r.status === "confirmed" || r.status === "pending")
          .map((r) => r.cal_booking_uid)
          .filter(Boolean)
      );

      let orphans = listed.bookings.filter((b) => !known.has(b.uid));
      if (body.nameContains) {
        const needle = body.nameContains.toLowerCase();
        orphans = orphans.filter((b) =>
          (b.attendeeName ?? "").toLowerCase().includes(needle)
        );
      }
      uids = orphans.map((b) => b.uid);
    }

    if (!uids.length) {
      return NextResponse.json({ cancelled: [], count: 0 });
    }

    const cancelled: string[] = [];
    const failed: Array<{ uid: string; error: string }> = [];

    for (const uid of uids) {
      const result = await cancelCalBooking(
        uid,
        "Admin cleanup: orphaned calendar booking without confirmed DB record"
      );
      if (result.ok) cancelled.push(uid);
      else failed.push({ uid, error: result.error ?? "cancel failed" });
    }

    return NextResponse.json({
      cancelled,
      failed,
      count: cancelled.length,
    });
  } catch (err) {
    logErrorWithCause("DELETE /api/admin/orphaned-cal-bookings", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}
