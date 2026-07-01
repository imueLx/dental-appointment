# BrightSmile Dental — Appointment System

A modern client-facing dental website built with **Next.js**, **shadcn/ui**, and **Cal.com** for scheduling. Marketing pages are custom; booking is powered by an embedded Cal.com calendar with staff admin, client-facing availability, and n8n/Zapier automation.

## Features

- **Landing page** — Hero, services preview, how-it-works, testimonials
- **Services** — Full list of dental treatments
- **Book appointment** — Embedded Cal.com scheduler (real-time availability)
- **Contact** — Contact form and clinic info
- **API routes** — Optional Supabase endpoints for custom automation

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Set up Cal.com (booking)

1. Create a free account at [cal.com](https://cal.com/signup)
2. Create an **Event Type** (e.g. "Dental Appointment", 60 min)
3. Set **availability** Mon–Fri 8am–5pm, **block lunch 1:00–2:00 PM** (not 12–1), 60 min slots
4. **Location** → In person (removes Google Meet)
5. **Profile → Time format** → 12 hour (AM/PM) — the 12h/24h toggle in the embed is controlled by Cal.com and cannot be hidden from code
4. Copy your booking link — e.g. `yourname` or `yourname/dental-appointment`
5. Add to `.env.local`:

```env
NEXT_PUBLIC_CAL_LINK=yourname/dental-appointment
```

6. Restart the dev server

### 3. Configure environment

Copy `.env.local.example` to `.env.local`. Minimum for booking:

```env
NEXT_PUBLIC_CAL_LINK=your-username/event-slug
```

Supabase keys are optional (only needed if using the legacy API routes).

### 4. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Cal.com + automation

- **Staff admin:** Manage hours, block days, view bookings in Cal.com dashboard
- **Client booking:** Embedded on `/book` with your site's branding
- **n8n / Zapier:** Cal.com → Settings → Developer → Webhooks
- **AI flows:** Trigger on `BOOKING_CREATED`, send confirmations, sync Google Calendar

## Tech stack

- Next.js 16 (App Router)
- TypeScript · Tailwind CSS v4 · shadcn/ui
- Cal.com embed (`@calcom/embed-react`)
- Optional: Supabase + REST API for custom automation

## Project structure

```
src/
├── app/              # Pages and API routes
├── components/
│   ├── booking/      # Cal.com embed + booking sidebar
│   ├── home/         # Landing page sections
│   ├── layout/       # Header, footer, page headers
│   └── contact/
└── lib/              # Constants, env helpers
```
