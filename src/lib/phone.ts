/**
 * Canonical PH mobile storage format: 10 digits starting with 9 (e.g. 9171234567).
 * Accepts 09…, +63 9…, 63 9…, or already-canonical 9….
 */
export function normalizePhMobile(input: string): string | null {
  let digits = input.replace(/\D/g, "");
  if (!digits) return null;

  if (digits.startsWith("63") && digits.length >= 12) {
    digits = digits.slice(2);
  }
  if (digits.startsWith("0")) {
    digits = digits.replace(/^0+/, "");
  }

  if (/^9\d{9}$/.test(digits)) return digits;
  return null;
}

/** Digits only (no PH rules) — for loose matching of legacy rows. */
export function phoneDigitsOnly(phone: string): string {
  return phone.replace(/\D/g, "");
}

/** E.164 for Cal.com / tel: links from a canonical 9XXXXXXXXX value. */
export function toPhE164(canonicalOrRaw: string): string {
  const normalized = normalizePhMobile(canonicalOrRaw);
  if (normalized) return `+63${normalized}`;
  const digits = phoneDigitsOnly(canonicalOrRaw);
  if (digits.startsWith("63")) return `+${digits}`;
  if (digits.startsWith("0") && digits.length === 11) {
    return `+63${digits.slice(1)}`;
  }
  if (/^9\d{9}$/.test(digits)) return `+63${digits}`;
  return canonicalOrRaw.trim();
}

/** Last 10 digits for DB lookup across 09… / +63… / 9… storage styles. */
export function phoneLookupSuffix(phone: string): string | null {
  const normalized = normalizePhMobile(phone);
  if (normalized) return normalized;
  const digits = phoneDigitsOnly(phone);
  if (digits.length < 10) return null;
  return digits.slice(-10);
}
