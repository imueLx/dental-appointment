import { createHash } from "crypto";

/** Stable SHA-256 key: normalizedPhone + slotIso + clinicLocationId */
export function buildBookingIdempotencyKey(
  normalizedPhone: string,
  slotIso: string,
  clinicLocationId: string
): string {
  return createHash("sha256")
    .update(`${normalizedPhone}|${slotIso}|${clinicLocationId}`)
    .digest("hex");
}
