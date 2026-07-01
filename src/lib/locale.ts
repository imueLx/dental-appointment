import { CLINIC, CLINIC_LOCALE, CLINIC_TIMEZONE } from "@/lib/constants";

export { CLINIC_LOCALE, CLINIC_TIMEZONE };

export function formatClinicDate(
  date: Date,
  options: Intl.DateTimeFormatOptions = {
    weekday: "long",
    month: "long",
    day: "numeric",
  }
): string {
  return date.toLocaleDateString(CLINIC_LOCALE, {
    timeZone: CLINIC_TIMEZONE,
    ...options,
  });
}
