import { Calendar, CheckCircle, Stethoscope } from "lucide-react";
import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { SectionHeading } from "@/components/layout/section-heading";

const STEPS = [
  {
    icon: Stethoscope,
    title: "Choose your service",
    description:
      "Select the treatment you need — cleaning, whitening, emergency care, and more.",
  },
  {
    icon: Calendar,
    title: "Pick a time",
    description:
      "See live availability and book an hour that fits your schedule.",
  },
  {
    icon: CheckCircle,
    title: "Get confirmed",
    description:
      "Receive instant confirmation by email. We'll remind you before your visit.",
  },
];

export function HowItWorks() {
  return (
    <Section>
      <Container>
        <SectionHeading
          eyebrow="Simple process"
          title="Book in three easy steps"
          description="Online scheduling powered by secure booking — no phone tag required."
          centered
        />

        <div className="relative grid gap-6 md:grid-cols-3 md:gap-8">
          <div className="pointer-events-none absolute top-12 right-[16.67%] left-[16.67%] hidden h-px bg-border md:block" />
          {STEPS.map((step, index) => (
            <div
              key={step.title}
              className="animate-in-up relative rounded-2xl border bg-card p-6 text-center shadow-sm"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="relative mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md shadow-primary/20">
                <step.icon className="size-6" />
                <span className="absolute -top-2 -right-2 flex size-6 items-center justify-center rounded-full bg-background text-xs font-bold text-primary ring-2 ring-primary">
                  {index + 1}
                </span>
              </div>
              <h3 className="text-lg font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </Container>
    </Section>
  );
}
