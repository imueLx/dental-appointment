# BrightSmile Dental — Appointment System

Patient site + AI chat scheduler for BrightSmile. **Next.js**, **Supabase**, **Cal.com** (staff calendar), and **n8n** (AI agent).

## Features

- Custom marketing pages + `/book` day/time picker
- Fast availability from **local clinic hours + Supabase** (no live Cal slots API — better from PH)
- Bookings sync to **Cal.com** for staff admin
- AI chat widget → n8n agent → same appointment APIs as manual booking
- Cal.com webhooks keep dashboard bookings in Supabase

## Getting started

### 1. Install

```bash
npm install
```

### 2. Environment

Copy [`.env.local.example`](.env.local.example) to `.env.local` and fill in values.

Minimum for local booking:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_CAL_LINK=username/event-slug
CAL_API_KEY=
APPOINTMENT_API_SECRET=
CLINIC_TIMEZONE=Asia/Manila
```

For AI chat, also set `N8N_SCHEDULER_WEBHOOK_URL` (and optional secret).

### 3. Supabase

Run SQL migrations in `supabase/migrations/` (Singapore region recommended).

### 4. Cal.com

1. Free account → event type (60 min, Mon–Fri, lunch 12–1 PM, Asia/Manila)
2. API key + booking link in env
3. Webhook → `https://your-domain/api/cal-webhook` (see [docs/free-hosting.md](docs/free-hosting.md))

### 5. Dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Free production hosting

See **[docs/free-hosting.md](docs/free-hosting.md)** — Vercel + Supabase + Cal.com + free n8n + Gemini.

## AI scheduler (n8n)

Guide: [docs/n8n-scheduler-workflow.md](docs/n8n-scheduler-workflow.md)

Flow: Chat widget → `POST /api/chat` → n8n AI Agent → `/api/cal-slots` + `/api/appointments`.

## Staff admin

Use the **Cal.com dashboard** to view/manage appointments and block time. Optional in-app `/admin` can come later.

## Tech stack

- Next.js (App Router) · TypeScript · Tailwind · shadcn/ui
- Supabase (appointments)
- Cal.com API (create / cancel / reschedule + staff UI)
- n8n (AI agent)

## Project structure

```
src/
├── app/                 # Pages + API routes
├── components/booking/  # Day/time picker + dialog
├── components/chat/     # AI chat widget
└── lib/                 # Cal, appointments, slots, n8n client
docs/                    # Hosting + n8n guides
supabase/migrations/
```
