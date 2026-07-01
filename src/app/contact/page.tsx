import type { Metadata } from "next";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ContactForm } from "@/components/contact/contact-form";
import { ClinicInfo } from "@/components/contact/clinic-info";
import { Container } from "@/components/layout/container";
import { PageHeader } from "@/components/layout/page-header";
import { Section } from "@/components/layout/section";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CLINIC } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Contact",
  description: "Get in touch with our dental clinic. We're here to help.",
};

const FAQ = [
  {
    q: "Do you accept walk-ins?",
    a: "We recommend booking online to guarantee your preferred time. Same-day appointments may be available — call us to check.",
  },
  {
    q: "What should I bring to my first visit?",
    a: "Please bring a valid ID, insurance card (if applicable), and a list of any medications you're currently taking.",
  },
  {
    q: "How do I reschedule or cancel?",
    a: "Use the link in your confirmation email or contact us at least 24 hours before your appointment.",
  },
];

export default function ContactPage() {
  return (
    <>
      <Section className="pb-0">
        <Container>
          <PageHeader
            eyebrow="Get in touch"
            title="Contact us"
            description="Questions about treatment, insurance, or scheduling? We're happy to help."
          />
        </Container>
      </Section>

      <Section variant="muted" className="pt-10">
        <Container>
          <div className="grid gap-8 lg:grid-cols-5">
            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle>Send a message</CardTitle>
              </CardHeader>
              <CardContent>
                <ContactForm />
              </CardContent>
            </Card>

            <div className="space-y-6 lg:col-span-2">
              <ClinicInfo />
              <div className="overflow-hidden rounded-xl border shadow-sm">
                <iframe
                  title="Clinic location"
                  src={`https://maps.google.com/maps?q=${CLINIC.mapQuery}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
                  className="h-56 w-full border-0"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
            </div>
          </div>

          <div className="mt-12">
            <h2 className="mb-4 text-xl font-semibold">Common questions</h2>
            <Accordion className="rounded-xl border bg-card px-4">
              {FAQ.map((item, i) => (
                <AccordionItem key={item.q} value={`faq-${i}`}>
                  <AccordionTrigger>{item.q}</AccordionTrigger>
                  <AccordionContent>{item.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </Container>
      </Section>
    </>
  );
}
