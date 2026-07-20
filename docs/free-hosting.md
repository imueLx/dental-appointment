# Free hosting setup (BrightSmile)

Target cost: **$0/mo** for the patient site + AI automation (within free tiers).

## Architecture

| Piece | Free host | Notes |
|-------|-----------|--------|
| Next.js app | [Vercel Hobby](https://vercel.com) | Prefer Singapore region |
| Database | [Supabase Free](https://supabase.com) | Prefer **Southeast Asia (Singapore)** |
| Calendar + staff admin | [Cal.com](https://cal.com) free | US API — used for **writes only** |
| AI chat automation | [n8n Cloud](https://n8n.io) free trial **or** [Render](https://render.com) free web service | See below |
| LLM | Google Gemini free tier (in n8n) | Groq as backup |

Slot listing (manual `/book` + AI) uses **Supabase + local clinic hours**, not live Cal slots — so PH users stay fast.

## 1) Supabase

1. Create a project in **Singapore** (or closest).
2. Run migrations in `supabase/migrations/` (SQL editor or CLI).
3. Copy URL + anon key + service role key into Vercel / `.env.local`.

## 2) Cal.com (staff admin + booking writes)

1. Sign up at cal.com (free).
2. Event type: 60 min, Mon–Fri, block lunch **12:00–1:00 PM**, Asia/Manila.
3. Create API key → `CAL_API_KEY`.
4. Booking link → `NEXT_PUBLIC_CAL_LINK=username/event-slug`.
5. Webhook (Developer → Webhooks):
   - URL: `https://YOUR_APP.vercel.app/api/cal-webhook`
   - Secret: same as `CAL_WEBHOOK_SECRET`
   - Events: `BOOKING_CREATED`, `BOOKING_CANCELLED`, `BOOKING_RESCHEDULED`

This keeps staff bookings made in the Cal dashboard in sync with Supabase (so the site and AI see them).

## 3) Vercel (Next.js) — free

1. Import this GitHub repo into Vercel.
2. Set env vars (see `.env.local.example`).
3. Deploy. Note the production URL for n8n tools.

## 4) n8n — free options

### Option A — n8n Cloud (easiest)

1. Sign up at [n8n.io](https://n8n.io) (free trial / free tier if available).
2. Build the scheduler workflow from [n8n-scheduler-workflow.md](./n8n-scheduler-workflow.md).
3. Use Gemini (or Groq) as the AI model credential.
4. Copy the webhook URL → `N8N_SCHEDULER_WEBHOOK_URL` on Vercel.

### Option B — Render free web service

1. Create a **Web Service** on Render (free).
2. Use the official n8n Docker image, e.g. `n8nio/n8n`.
3. Set `WEBHOOK_URL` / `N8N_HOST` to your Render URL (HTTPS).
4. Free tier sleeps after idle — first chat after sleep can be slow; wake it or upgrade later if needed.
5. Same workflow as Option A.

### Option C — local n8n (dev only)

```bash
npx n8n
```

Point `N8N_SCHEDULER_WEBHOOK_URL` at your tunnel (ngrok / Cloudflare Tunnel) while testing.

## 5) Env checklist

```env
# Supabase (Singapore)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Cal.com
NEXT_PUBLIC_CAL_LINK=username/event-slug
CAL_API_KEY=
CAL_WEBHOOK_SECRET=

# AI chat → n8n
N8N_SCHEDULER_WEBHOOK_URL=
N8N_SCHEDULER_WEBHOOK_SECRET=
APPOINTMENT_API_SECRET=

CLINIC_TIMEZONE=Asia/Manila
```

## Manual vs AI

Both use the same backend:

| Action | Manual `/book` | AI chat (n8n) |
|--------|----------------|---------------|
| List days/hours | `/api/cal-availability`, `/api/cal-slots` | Same HTTP tools |
| Create booking | server action → `createAppointment` | `POST /api/appointments` |
| Cancel / reschedule | (staff: Cal dashboard or later `/admin`) | PATCH/DELETE appointments |

So a slot taken by the AI disappears from the manual picker, and vice versa.

## Cost reality check

- Vercel + Supabase + Cal.com + Gemini: usually **$0**
- n8n Cloud free limits or Render sleep are the main tradeoffs
- If free n8n becomes too limited, a ~$5–7 VPS running only n8n is the cheapest paid upgrade
