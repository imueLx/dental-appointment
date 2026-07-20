# n8n AI Scheduler Workflow

This guide describes how to connect the BrightSmile site chat widget to an n8n workflow that handles booking, rescheduling, and cancellation.

## Architecture

```
User → Chat Widget → POST /api/chat → n8n Webhook → AI Agent → Appointment APIs → Supabase + Cal.com
```

Availability tools (`/api/cal-slots`, `/api/cal-availability`) use **local clinic hours + Supabase** (fast). Create/cancel/reschedule write to **Cal.com** then Supabase.

The Next.js app proxies chat messages so your n8n webhook URL stays server-side only.

Free hosting (Vercel + free n8n): see [free-hosting.md](./free-hosting.md).

## Environment setup

In `.env.local` on the Next.js app:

```env
N8N_SCHEDULER_WEBHOOK_URL=https://your-n8n.example.com/webhook/scheduler
N8N_SCHEDULER_WEBHOOK_SECRET=your-shared-secret
APPOINTMENT_API_SECRET=your-api-secret
NEXT_PUBLIC_CAL_LINK=your-username/your-event-slug
CAL_API_KEY=cal_live_...
```

In n8n, verify incoming requests using the `X-Webhook-Secret` header if configured.

Set your deployed app URL in n8n HTTP Request nodes, e.g. `https://your-site.vercel.app`.

## Webhook trigger

Create a **Webhook** node:

- **Method:** POST
- **Path:** `scheduler` (or any path you prefer)
- **Response mode:** When last node finishes

**Expected input from `/api/chat`:**

```json
{
  "message": "I need to book a cleaning",
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "history": [
    { "role": "user", "content": "Hi" },
    { "role": "assistant", "content": "Hello! How can I help?" }
  ]
}
```

## Stable contract (keep this stable for future n8n workflows)

The Next.js proxy forwards the following JSON to your n8n webhook:

Request keys:
- `message` (string, 1–2000 chars)
- `sessionId` (optional UUID)
- `history` (optional, up to 50 items of `{ role: "user" | "assistant", content: string }`)

Your n8n workflow should respond with JSON:
- `reply` (string, preferred)
- `message` (string, accepted as a fallback for `reply`)

Auth:
- If `N8N_SCHEDULER_WEBHOOK_SECRET` is set in the Next.js app, the proxy includes `X-Webhook-Secret` in the webhook request header.

## AI Agent system prompt

Use this as a starting system prompt for your AI Agent node:

```
You are the BrightSmile Dental schedule assistant. Help patients book, reschedule, or cancel appointments.

Clinic rules:
- Hours: Monday–Friday, 8:00–11:00 AM and 1:00–4:00 PM (Asia/Manila)
- Lunch break 12:00–1:00 PM — no bookings
- Booking window: tomorrow through 30 days ahead
- Weekends are closed

Before booking, collect: full name, phone number, preferred branch, service, date, and time.
Before cancel/reschedule, look up appointments by phone number and confirm which appointment to change.

Branches:
- sm-southmall — SM Southmall, Las Piñas
- sm-megamall — SM Megamall, Mandaluyong

Services: Dental Cleaning, Fillings & Restorations, Teeth Whitening, Root Canal Therapy, Orthodontics, Emergency Care

Always confirm details before creating, rescheduling, or cancelling.
Use friendly, concise language. Times are in Philippine time (PHT).
Phone numbers: accept 09… or +63 9…; the API stores them as 10-digit 9XXXXXXXXX (no leading 0 or +63). When calling findAppointments or bookAppointment, any of those formats is fine.
Never say a booking/cancel/reschedule succeeded unless the matching tool returned HTTP 200 with cancelled/rescheduled/appointment success fields.
If cancel returns 404, say you could not cancel and offer to look up appointments again — do NOT tell the user it was cancelled.
```

## HTTP Request tools for the AI Agent

Configure each tool as an HTTP Request node (or use n8n AI Agent tool definitions).

**Auth header for all appointment tools:**

```
Authorization: Bearer {{ $env.APPOINTMENT_API_SECRET }}
```

Replace `{{ $env.APPOINTMENT_API_SECRET }}` with your secret or use n8n credentials.

### Prefer body-based cancel / reschedule (n8n-friendly)

Path params like `/appointments/{id}` are easy to misconfigure in n8n HTTP Request Tool. Use these instead:

**Cancel (POST body):**
```
POST {{APP_URL}}/api/appointments/cancel
Authorization: Bearer {{APPOINTMENT_API_SECRET}}
Content-Type: application/json

{ "id": "<appointment-uuid-from-findAppointments>" }
```

**Book (POST body):**
```
POST {{APP_URL}}/api/appointments/book
Authorization: Bearer {{APPOINTMENT_API_SECRET}}
Content-Type: application/json

{
  "appointmentDate": "2026-07-03",
  "startHour": 9,
  "clinicLocationId": "sm-southmall",
  "patientName": "Juan Dela Cruz",
  "patientPhone": "9171234567",
  "patientEmail": "",
  "service": "Dental Cleaning",
  "slotIso": "2026-07-03T09:00:00+08:00"
}
```

**Reschedule (POST body):**
```
POST {{APP_URL}}/api/appointments/reschedule
Authorization: Bearer {{APPOINTMENT_API_SECRET}}
Content-Type: application/json

{
  "id": "<appointment-uuid>",
  "appointmentDate": "2026-07-04",
  "startHour": 14,
  "slotIso": "2026-07-04T14:00:00+08:00"
}
```

### 1. listOpenDays

```
GET {{APP_URL}}/api/cal-availability?from=2026-07-03&to=2026-07-10
```

Returns `{ dates: { "2026-07-03": 3 } }` — number of open slots per day.

### 2. checkAvailability

```
GET {{APP_URL}}/api/cal-slots?date=2026-07-03
```

Returns `{ availableHours: [8, 9, 13], slotTimes: { "9": "2026-07-03T09:00:00+08:00" } }`.

Use `slotTimes[hour]` as `slotIso` when booking for the scheduler accuracy.

### 3. findAppointments

```
GET {{APP_URL}}/api/appointments?phone=+639171234567
Authorization: Bearer {{APPOINTMENT_API_SECRET}}
```

Returns upcoming confirmed appointments for that phone number.

### 4. bookAppointment

```
POST {{APP_URL}}/api/appointments
Authorization: Bearer {{APPOINTMENT_API_SECRET}}
Content-Type: application/json

{
  "appointmentDate": "2026-07-03",
  "startHour": 9,
  "clinicLocationId": "sm-southmall",
  "patientName": "Juan Dela Cruz",
  "patientPhone": "+639171234567",
  "patientEmail": "",
  "service": "Dental Cleaning",
  "slotIso": "2026-07-03T09:00:00+08:00"
}
```

### 5. rescheduleAppointment

```
PATCH {{APP_URL}}/api/appointments/{id}
Authorization: Bearer {{APPOINTMENT_API_SECRET}}
Content-Type: application/json

{
  "appointmentDate": "2026-07-04",
  "startHour": 14,
  "slotIso": "2026-07-04T14:00:00+08:00"
}
```

### 6. cancelAppointment

```
DELETE {{APP_URL}}/api/appointments/{id}
Authorization: Bearer {{APPOINTMENT_API_SECRET}}
```

## Respond to Webhook

The last node must return JSON the chat widget understands:

```json
{
  "reply": "Your appointment is confirmed for July 3 at 9:00 AM at SM Southmall."
}
```

If using an AI Agent node, map its text output to the `reply` field in a **Set** node before **Respond to Webhook**.

## Optional: session memory

Add a **Simple Memory** node (or Redis/chat memory) keyed on `{{ $json.sessionId }}` so multi-turn conversations stay coherent across messages.

The client also sends `history` (last messages) which you can pass directly to the AI model as context.

## Workflow diagram

```mermaid
flowchart LR
  webhook[WebhookTrigger] --> agent[AIAgent]
  agent --> toolSlots[HTTP cal-slots]
  agent --> toolDays[HTTP cal-availability]
  agent --> toolLookup[HTTP GET by phone]
  agent --> toolBook[HTTP POST appointments]
  agent --> toolReschedule[HTTP PATCH]
  agent --> toolCancel[HTTP DELETE]
  agent --> respond[RespondToWebhook]
```

## Testing locally

1. Run n8n locally or use n8n Cloud
2. Activate the workflow and copy the webhook URL
3. Set `N8N_SCHEDULER_WEBHOOK_URL` in `.env.local`
4. Run `npm run dev` and open the chat icon (bottom-right)
5. Send a test message — n8n should receive the payload

For appointment API testing without the AI, use curl:

```bash
curl -H "Authorization: Bearer YOUR_SECRET" \
  "http://localhost:3000/api/appointments?phone=%2B639171234567"
```

## Database migration

Run the Supabase migration to add booking UID storage for scheduler cancel/reschedule:

```
supabase/migrations/005_cal_booking_uid.sql
```

This adds `cal_booking_uid` column required for cancel/reschedule sync.
