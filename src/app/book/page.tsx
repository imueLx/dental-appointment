import type { Metadata } from "next";
import { DaySlotPicker } from "@/components/booking/day-slot-picker";
import { Container } from "@/components/layout/container";
import { PageHeader } from "@/components/layout/page-header";
import { Section } from "@/components/layout/section";

export const metadata: Metadata = {
  title: "Book Appointment",
  description: "Pick a date and time for your dental visit.",
};

export default function BookPage() {
  return (
    <Section variant="muted" className="py-10 sm:py-24">
      <Container className="max-w-5xl space-y-6 sm:space-y-8">
        <PageHeader
          eyebrow="Scheduling"
          title="Book your appointment"
          description="Choose a date, then select an available time slot."
          centered
        />
        <DaySlotPicker />
      </Container>
    </Section>
  );
}
