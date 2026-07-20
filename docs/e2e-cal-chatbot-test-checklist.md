# E2E Test Checklist (Cal.com + n8n + chatbot)

Flow under test:

`Chat widget → /api/chat → n8n → /api/appointments → Cal.com + Supabase`  
Staff bookings: `Cal.com dashboard → /api/cal-webhook → Supabase`

## Prerequisites

1. Supabase migrations applied (including `006_cal_booking_uid_unique.sql`).
2. Env set: `NEXT_PUBLIC_CAL_LINK`, `CAL_API_KEY`, Supabase keys, `APPOINTMENT_API_SECRET`.
3. Cal.com webhook → `https://your-site.com/api/cal-webhook` with `CAL_WEBHOOK_SECRET`.
4. n8n scheduler workflow active; `N8N_SCHEDULER_WEBHOOK_URL` set.
5. App deployed or running locally (`npm run dev`).

## A) Manual `/book`

1. Open `/book` — calendar/slots load quickly (no multi-second Cal wait).
2. Pick a date/time and submit.
3. Row appears in Supabase `appointments` with `cal_booking_uid`.
4. Same booking appears in Cal.com dashboard.
5. That slot disappears from `/book` and from `/api/cal-slots`.

## B) AI chat booking

1. Open chat widget; ask to book a cleaning.
2. Agent lists open days/hours via `/api/cal-availability` and `/api/cal-slots`.
3. Confirm booking with name, phone, branch, service, date, time.
4. Appointment exists in Supabase + Cal.com.
5. Slot no longer available on manual `/book`.

## C) Staff booking in Cal.com

1. Create a booking in Cal.com dashboard.
2. `/api/cal-webhook` receives `BOOKING_CREATED`.
3. Supabase has a matching row; slot is blocked on `/book` and for AI.

## D) Cancel / reschedule

1. Cancel via AI (`DELETE /api/appointments/{id}`) → Cal + Supabase cancelled; slot reopens.
2. Or cancel in Cal.com → webhook marks Supabase cancelled; slot reopens.
3. Reschedule via AI (`PATCH`) → Cal + Supabase updated.

## E) Latency smoke check (PH)

- Switching dates on `/book` should feel snappy (local + Supabase only).
- Only the submit/book action may wait on Cal.com (US).
