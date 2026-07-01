import type { Metadata } from "next";
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
import { PageHeader } from "@/components/layout/page-header";
import { Section } from "@/components/layout/section";
import { SERVICES } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Services",
  description: "Explore our comprehensive dental services and treatments.",
};

const ICONS = {
  sparkles: Sparkles,
  shield: Shield,
  sun: Sun,
  heart: Heart,
  align: AlignCenter,
  alert: AlertCircle,
} as const;

export default function ServicesPage() {
  return (
    <>
      <Section className="pb-0">
        <Container className="space-y-10">
          <PageHeader
            eyebrow="Treatments"
            title="Our services"
            description="Comprehensive dental care — from preventive cleanings to emergency treatment — delivered with a gentle, modern approach."
            centered
          />
        </Container>
      </Section>

      <Section variant="muted" className="pt-10">
        <Container>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {SERVICES.map((service, i) => {
              const Icon = ICONS[service.icon];
              return (
                <Card
                  key={service.id}
                  className="animate-in-up transition-shadow hover:shadow-md"
                  style={{ animationDelay: `${i * 0.05}s` }}
                >
                  <CardHeader>
                    <div className="mb-3 flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
                      <Icon className="size-5" />
                    </div>
                    <CardTitle className="text-lg">{service.name}</CardTitle>
                    <CardDescription className="leading-relaxed">
                      {service.description}
                    </CardDescription>
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

          <Card className="mt-12 overflow-hidden border-primary/20 bg-primary text-primary-foreground">
            <CardContent className="py-10 text-center sm:py-12">
              <h2 className="text-2xl font-semibold">
                Not sure which service you need?
              </h2>
              <p className="mx-auto mt-2 max-w-lg text-primary-foreground/80">
                Book a general consultation and we&apos;ll recommend the right
                treatment for your smile.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Link
                  href="/book"
                  className={buttonVariants({
                    className:
                      "bg-primary-foreground text-primary hover:bg-primary-foreground/90",
                  })}
                >
                  Book appointment
                </Link>
                <Link
                  href="/contact"
                  className={buttonVariants({
                    variant: "outline",
                    className:
                      "border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground",
                  })}
                >
                  Ask a question
                  <ArrowRight className="size-4" />
                </Link>
              </div>
            </CardContent>
          </Card>
        </Container>
      </Section>
    </>
  );
}
