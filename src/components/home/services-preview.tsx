import Link from "next/link";
import {
  AlertCircle,
  AlignCenter,
  ArrowRight,
  Heart,
  Shield,
  Sparkles,
  Sun,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { SectionHeading } from "@/components/layout/section-heading";
import { SERVICES } from "@/lib/constants";

const ICONS = {
  sparkles: Sparkles,
  shield: Shield,
  sun: Sun,
  heart: Heart,
  align: AlignCenter,
  alert: AlertCircle,
} as const;

export function ServicesPreview() {
  const preview = SERVICES.slice(0, 3);

  return (
    <Section variant="muted">
      <Container>
        <div className="mb-12 flex flex-col items-start justify-between gap-4 sm:mb-16 sm:flex-row sm:items-end">
          <SectionHeading
            eyebrow="What we offer"
            title="Comprehensive dental care"
            description="From routine cleanings to emergency care, tailored to your needs."
            className="mb-0"
          />
          <Link
            href="/services"
            className={buttonVariants({
              variant: "outline",
              className: "hidden shrink-0 gap-1 sm:inline-flex",
            })}
          >
            All services
            <ArrowRight className="size-4" />
          </Link>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {preview.map((service, i) => {
            const Icon = ICONS[service.icon];
            return (
              <Card
                key={service.id}
                className="animate-in-up transition-shadow hover:shadow-md"
                style={{ animationDelay: `${i * 0.08}s` }}
              >
                <CardHeader>
                  <div className="mb-2 flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="size-5" />
                  </div>
                  <CardTitle className="text-lg">{service.name}</CardTitle>
                  <CardDescription>{service.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <span className="inline-flex rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                    {service.duration} visit
                  </span>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="mt-8 text-center sm:hidden">
          <Link href="/services" className={buttonVariants({ variant: "outline" })}>
            View all services
          </Link>
        </div>
      </Container>
    </Section>
  );
}
