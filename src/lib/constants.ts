export const CLINIC_LOCALE = "en-PH" as const;
export const CLINIC_TIMEZONE = "Asia/Manila" as const;

export const CLINIC = {
  name: "BrightSmile Dental",
  tagline: "Modern dentistry for confident smiles",
  phone: "+63 917 123 4567",
  phonePlaceholder: "+63 917 123 4567",
  email: "hello@brightsmile.ph",
  address: "Unit 502, Ayala Triangle Gardens Tower 2",
  city: "Makati City, Metro Manila 1226",
  country: "Philippines",
  mapQuery: "Ayala+Triangle+Gardens+Makati+Philippines",
  hours: "Monday – Friday: 8:00 AM – 5:00 PM (PHT)",
  lunchBreak: "12:00 PM – 1:00 PM",
} as const;

/** Cal.com branch options — must match event type field "Clinic-Address" exactly */
export const CLINIC_LOCATIONS = [
  {
    id: "sm-southmall",
    calValue: "SM Southmall BrightSmile",
    label: "SM Southmall",
    address: "SM Southmall, Las Piñas City, Metro Manila",
  },
  {
    id: "sm-megamall",
    calValue: "SM Megamall BrightSmile",
    label: "SM Megamall",
    address: "SM Megamall, Mandaluyong City, Metro Manila",
  },
] as const;

export type ClinicLocationId = (typeof CLINIC_LOCATIONS)[number]["id"];

export function getClinicLocationById(id: ClinicLocationId | string) {
  const match = CLINIC_LOCATIONS.find((l) => l.id === id);
  return match ?? CLINIC_LOCATIONS[0];
}

export function getDefaultClinicLocation() {
  const fromEnv = process.env.CAL_CLINIC_LOCATION?.trim();
  if (fromEnv) {
    const match = CLINIC_LOCATIONS.find((l) => l.calValue === fromEnv);
    if (match) return match;
  }
  return CLINIC_LOCATIONS[0];
}

/** Digits-only phone for tel: links (e.g. +639171234567) */
export function clinicPhoneTel(phone: string = CLINIC.phone): string {
  const digits = phone.replace(/\D/g, "");
  return `+${digits}`;
}

/** Scheduling rules — 1 hour appointments, 1 patient per slot, lunch 12–1 PM */
export const SCHEDULE = {
  durationMinutes: 60,
  patientsPerSlot: 1,
  lunchStart: "12:00 PM",
  lunchEnd: "1:00 PM",
} as const;

export const CAL_BRAND_COLOR = "#0f766e";

export const CLINIC_STATS = [
  { value: "2,500+", label: "Happy patients" },
  { value: "15+", label: "Years experience" },
  { value: "4.9", label: "Average rating" },
] as const;

export const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/services", label: "Services" },
  { href: "/book", label: "Book" },
  { href: "/contact", label: "Contact" },
] as const;

export const SERVICES = [
  {
    id: "cleaning",
    name: "Dental Cleaning",
    description:
      "Professional cleaning and preventive care to keep your smile healthy and bright.",
    duration: "1 hour",
    icon: "sparkles",
  },
  {
    id: "fillings",
    name: "Fillings & Restorations",
    description:
      "Tooth-colored fillings and restorations that blend seamlessly with your natural teeth.",
    duration: "1 hour",
    icon: "shield",
  },
  {
    id: "whitening",
    name: "Teeth Whitening",
    description:
      "Safe, effective whitening treatments for a noticeably brighter smile.",
    duration: "1 hour",
    icon: "sun",
  },
  {
    id: "root-canal",
    name: "Root Canal Therapy",
    description:
      "Gentle, modern root canal treatment to save damaged teeth and relieve pain.",
    duration: "1 hour",
    icon: "heart",
  },
  {
    id: "orthodontics",
    name: "Orthodontics",
    description:
      "Clear aligners and orthodontic solutions for straighter, healthier teeth.",
    duration: "1 hour",
    icon: "align",
  },
  {
    id: "emergency",
    name: "Emergency Care",
    description:
      "Same-day urgent dental care when you need relief fast.",
    duration: "1 hour",
    icon: "alert",
  },
] as const;

export const SERVICE_NAMES = SERVICES.map((s) => s.name) as [
  string,
  ...string[],
];

export const TESTIMONIALS = [
  {
    quote:
      "The team made me feel completely at ease. Best dental experience I've ever had.",
    author: "Ana R.",
    role: "Patient since 2022",
  },
  {
    quote:
      "Booking online was so easy, and the clinic is beautiful and modern. Highly recommend!",
    author: "Mark T.",
    role: "Patient since 2023",
  },
  {
    quote:
      "Professional, gentle, and thorough. My whole family comes here now.",
    author: "Maria G.",
    role: "Patient since 2021",
  },
] as const;
