/**
 * List / cancel Cal.com bookings that have no confirmed/pending Supabase row.
 *
 * Usage (from repo root, with env loaded):
 *   node --env-file=.env.local scripts/cleanup-orphaned-cal-bookings.mjs
 *   node --env-file=.env.local scripts/cleanup-orphaned-cal-bookings.mjs --cancel --name "test-dev"
 *   node --env-file=.env.local scripts/cleanup-orphaned-cal-bookings.mjs --cancel --name "John Uel"
 *
 * Or against a deployed app:
 *   APP_URL=https://dental-appointment-ten.vercel.app \
 *   APPOINTMENT_API_SECRET=... \
 *   node scripts/cleanup-orphaned-cal-bookings.mjs --remote --cancel --name "test-dev"
 */

const args = new Set(process.argv.slice(2));
const nameIdx = process.argv.indexOf("--name");
const nameContains =
  nameIdx >= 0 ? process.argv[nameIdx + 1] : undefined;
const doCancel = args.has("--cancel");
const remote = args.has("--remote");

async function viaRemote() {
  const base = (process.env.APP_URL ?? "").replace(/\/$/, "");
  const secret = process.env.APPOINTMENT_API_SECRET;
  if (!base || !secret) {
    throw new Error("Set APP_URL and APPOINTMENT_API_SECRET for --remote");
  }

  const headers = {
    Authorization: `Bearer ${secret}`,
    "Content-Type": "application/json",
  };

  const listRes = await fetch(`${base}/api/admin/orphaned-cal-bookings`, {
    headers,
  });
  const listed = await listRes.json();
  if (!listRes.ok) {
    console.error(listed);
    process.exit(1);
  }

  console.log(`Found ${listed.count} orphan(s) of ${listed.checked} checked:`);
  for (const o of listed.orphans ?? []) {
    console.log(`- ${o.uid} | ${o.attendeeName ?? "?"} | ${o.start ?? "?"}`);
  }

  if (!doCancel) {
    console.log("Dry run. Pass --cancel to cancel orphans.");
    return;
  }

  const delRes = await fetch(`${base}/api/admin/orphaned-cal-bookings`, {
    method: "DELETE",
    headers,
    body: JSON.stringify({
      cancelAllOrphans: !nameContains,
      nameContains,
    }),
  });
  const result = await delRes.json();
  console.log(result);
}

async function viaDirect() {
  const { createClient } = await import("@supabase/supabase-js");

  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
  const calKey = process.env.CAL_API_KEY;

  if (!url || !key || !calKey) {
    throw new Error(
      "Need NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CAL_API_KEY"
    );
  }

  const listRes = await fetch(
    "https://api.cal.com/v2/bookings?status=upcoming&take=100",
    {
      headers: {
        Authorization: `Bearer ${calKey}`,
        "cal-api-version": "2024-08-13",
      },
    }
  );
  const listJson = await listRes.json();
  if (!listRes.ok) {
    console.error(listJson);
    process.exit(1);
  }

  const bookings = (listJson.data ?? []).filter((b) => b.uid);
  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const uids = bookings.map((b) => b.uid);
  const { data: rows } = await supabase
    .from("appointments")
    .select("cal_booking_uid, status")
    .in("cal_booking_uid", uids.length ? uids : ["__none__"]);

  const known = new Set(
    (rows ?? [])
      .filter((r) => r.status === "confirmed" || r.status === "pending")
      .map((r) => r.cal_booking_uid)
      .filter(Boolean)
  );

  let orphans = bookings.filter((b) => !known.has(b.uid));
  if (nameContains) {
    const needle = nameContains.toLowerCase();
    orphans = orphans.filter((b) =>
      String(b.attendees?.[0]?.name ?? "")
        .toLowerCase()
        .includes(needle)
    );
  }

  console.log(`Found ${orphans.length} orphan(s):`);
  for (const o of orphans) {
    console.log(
      `- ${o.uid} | ${o.attendees?.[0]?.name ?? "?"} | ${o.start ?? o.startTime ?? "?"}`
    );
  }

  if (!doCancel) {
    console.log("Dry run. Pass --cancel to cancel orphans.");
    return;
  }

  for (const o of orphans) {
    const res = await fetch(
      `https://api.cal.com/v2/bookings/${encodeURIComponent(o.uid)}/cancel`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${calKey}`,
          "Content-Type": "application/json",
          "cal-api-version": "2024-08-13",
        },
        body: JSON.stringify({
          cancellationReason:
            "Script cleanup: orphaned calendar booking without confirmed DB record",
        }),
      }
    );
    console.log(o.uid, res.status, res.ok ? "cancelled" : await res.text());
  }
}

(async () => {
  if (remote) await viaRemote();
  else await viaDirect();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
