/** Supabase URL — supports legacy and current Supabase dashboard names */
export function getSupabaseUrl(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
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
