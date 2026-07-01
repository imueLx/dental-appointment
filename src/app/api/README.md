# Appointment API

REST endpoints for AI automation and external calendar sync.

## Authentication

Protected routes require:

```
Authorization: Bearer <APPOINTMENT_API_SECRET>
```

Set `APPOINTMENT_API_SECRET` in `.env.local`.

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

### GET /api/appointments (authenticated)

Returns full appointment details for a date range.

**Query params:** `from`, `to`

### POST /api/appointments (authenticated)

Create an appointment.

**Body:**
```json
{
  "appointmentDate": "2026-07-01",
  "startHour": 9,
  "patientName": "Jane Doe",
  "patientEmail": "jane@example.com",
  "patientPhone": "+639171234567",
  "service": "Dental Cleaning",
  "notes": "optional"
}
```

### DELETE /api/appointments/[id] (authenticated)

Cancel an appointment (sets status to `cancelled`).
