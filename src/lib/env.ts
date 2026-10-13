/** Supabase URL — supports legacy and current Supabase dashboard names */
export function getSupabaseUrl(): string | undefined {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  if (!raw) return undefined;
  return raw.trim().replace(/\/$/, "");
}

/**
 * Validate Supabase URL for server-side fetch (avoids cryptic TypeError: fetch failed).
 * Returns an error message when invalid; null when OK.
 */
export function getSupabaseUrlError(): string | null {
  const url = getSupabaseUrl();
  if (!url) {
    return "Missing NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) in environment";
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return `Invalid Supabase URL: ${url}`;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return `Supabase URL must be http(s), got ${parsed.protocol}`;
  }
  const host = parsed.hostname.toLowerCase();
  if (
    process.env.VERCEL === "1" &&
    (host === "localhost" || host === "127.0.0.1" || host === "::1")
  ) {
    return `Supabase URL points to ${host} on Vercel — use your project https://*.supabase.co URL`;
  }
  return null;
}

/** Client-safe key (Publishable / anon) */
export function getSupabaseAnonKey(): string | undefined {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.SUPABASE_PUBLISHABLE_KEY
  );
}

/** Cal.com booking link — format: username or username/event-slug */
export function getCalLink(): string | undefined {
  const raw = process.env.NEXT_PUBLIC_CAL_LINK;
  if (!raw) return undefined;
  return normalizeCalLink(raw);
}

/** Strips https://cal.com/ prefix if pasted as full URL */
export function normalizeCalLink(link: string): string {
  return link
    .trim()
    .replace(/^https?:\/\/(www\.)?cal\.com\//i, "")
    .replace(/\/$/, "");
}

/** Server-only key (Secret / service_role) — never expose to the browser */
export function getSupabaseServiceKey(): string | undefined {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY
  );
}

/** Optional shared secret for Cal.com → /api/cal-webhook */
export function getCalWebhookSecret(): string | undefined {
  return process.env.CAL_WEBHOOK_SECRET;
}

/** n8n scheduler webhook URL (server-side only) */
export function getN8nSchedulerWebhookUrl(): string | undefined {
  return process.env.N8N_SCHEDULER_WEBHOOK_URL;
}

/** Optional shared secret for verifying webhook requests (server-side only) */
export function getN8nSchedulerWebhookSecret(): string | undefined {
  return process.env.N8N_SCHEDULER_WEBHOOK_SECRET;
}
