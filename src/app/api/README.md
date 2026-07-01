# Appointment API

REST endpoints for AI automation, n8n workflows, and external calendar sync.

## Authentication

Protected routes require:

```
Authorization: Bearer <APPOINTMENT_API_SECRET>
```

Set `APPOINTMENT_API_SECRET` in `.env.local`.

## Chat proxy (n8n)

### POST /api/chat (public)

Proxies messages from the site chat widget to your n8n webhook. The webhook URL is never exposed to the browser.

**Request body:**
```json
{
  "message": "I want to book a cleaning tomorrow",
  "sessionId": "uuid-from-client",
  "history": [{ "role": "user", "content": "..." }, { "role": "assistant", "content": "..." }]
}
```

**Response:**
```json
{ "reply": "I found openings on July 3 at 9 AM and 2 PM. Which works for you?" }
```

**Environment variables:**

| Variable | Purpose |
|---|---|
| `N8N_SCHEDULER_WEBHOOK_URL` | n8n Webhook trigger URL |
| `N8N_SCHEDULER_WEBHOOK_SECRET` | Optional secret sent as `X-Webhook-Secret` header |

See [n8n scheduler workflow guide](../docs/n8n-scheduler-workflow.md) for the full n8n setup.

---

## Endpoints

### GET /api/availability (public)

Returns booked slots without patient information.

**Query params:** `from` (YYYY-MM-DD), `to` (YYYY-MM-DD)

**Response:**
```json
{
  "slots": [
    { "appointment_date": "2026-07-01", "start_time": "09:00:00" }
  ]
}
```

### GET /api/cal-availability (public)

Open slot counts per day (Cal.com + Supabase merge).

**Query params:** `from`, `to`, optional `timeZone`

**Response:**
```json
{
  "dates": { "2026-07-03": 3, "2026-07-04": 5 },
  "timeZone": "Asia/Manila"
}
```

### GET /api/cal-slots (public)

Available hours for a single date.

**Query params:** `date` (YYYY-MM-DD), optional `timeZone`

**Response:**
```json
{
  "date": "2026-07-03",
  "availableHours": [8, 9, 13, 14],
  "slotTimes": { "9": "2026-07-03T09:00:00+08:00" },
  "configured": true,
  "timeZone": "Asia/Manila"
}
```

### GET /api/appointments (authenticated)

Returns full appointment details.

**By date range:** `?from=YYYY-MM-DD&to=YYYY-MM-DD`

**By phone (upcoming):** `?phone=+639171234567`

Optional: `?phone=...&upcomingOnly=false` to include past appointments.

**Response:**
```json
{
  "appointments": [
    {
      "id": "uuid",
      "appointment_date": "2026-07-03",
      "start_time": "09:00:00",
      "patient_name": "Jane Doe",
      "patient_phone": "+639171234567",
      "service": "Dental Cleaning",
      "status": "confirmed",
      "cal_booking_uid": "abc123"
    }
  ]
}
```

### POST /api/appointments (authenticated)

Create an appointment with Cal.com sync (when configured).

**Body:**
```json
{
  "appointmentDate": "2026-07-03",
  "startHour": 9,
  "clinicLocationId": "sm-southmall",
  "patientName": "Jane Doe",
  "patientEmail": "jane@example.com",
  "patientPhone": "+639171234567",
  "service": "Dental Cleaning",
  "notes": "optional",
  "slotIso": "2026-07-03T09:00:00+08:00"
}
```

**clinicLocationId values:** `sm-southmall`, `sm-megamall`

**service values:** Dental Cleaning, Fillings & Restorations, Teeth Whitening, Root Canal Therapy, Orthodontics, Emergency Care

**Response (201):**
```json
{
  "appointment": {
    "id": "uuid",
    "calSynced": true,
    "calBookingUid": "abc123"
  }
}
```

### PATCH /api/appointments/[id] (authenticated)

Reschedule an appointment. Syncs to Cal.com when `cal_booking_uid` is stored.

**Body:**
```json
{
  "appointmentDate": "2026-07-04",
  "startHour": 14,
  "slotIso": "2026-07-04T14:00:00+08:00"
}
```

### DELETE /api/appointments/[id] (authenticated)

Cancel an appointment (sets `status = cancelled`). Cancels on Cal.com when `cal_booking_uid` is present.

---

## n8n tool quick reference

| Tool | Method | Endpoint |
|---|---|---|
| List open days | GET | `/api/cal-availability?from=&to=` |
| Check slots for date | GET | `/api/cal-slots?date=` |
| Find by phone | GET | `/api/appointments?phone=` |
| Book | POST | `/api/appointments` |
| Reschedule | PATCH | `/api/appointments/{id}` |
| Cancel | DELETE | `/api/appointments/{id}` |

All authenticated appointment routes use header: `Authorization: Bearer <APPOINTMENT_API_SECRET>`
