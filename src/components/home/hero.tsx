import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  Shield,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Container } from "@/components/layout/container";
import { CLINIC, CLINIC_STATS } from "@/lib/constants";

const HIGHLIGHTS = [
  { icon: Calendar, label: "Instant online booking" },
  { icon: Shield, label: "Experienced clinicians" },
  { icon: Sparkles, label: "Modern equipment" },
] as const;

export function Hero() {
  return (
    <section className="relative overflow-hidden border-b">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,oklch(0.52_0.11_180/0.08),transparent_60%)]" />
      <div className="pointer-events-none absolute -left-32 top-1/2 size-96 -translate-y-1/2 rounded-full bg-primary/5 blur-3xl" />

      <Container>
        <div className="grid items-center gap-12 py-16 sm:py-20 lg:grid-cols-2 lg:gap-16 lg:py-28">
          <div className="animate-in-up">
            <Badge variant="secondary" className="mb-6 gap-1.5 px-3 py-1">
              <Sparkles className="size-3.5 text-primary" />
              {CLINIC.tagline}
            </Badge>

            <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl lg:text-[3.25rem] lg:leading-[1.1]">
              Gentle care for{" "}
              <span className="text-primary">healthier smiles</span>
            </h1>

            <p className="mt-6 max-w-lg text-lg leading-relaxed text-muted-foreground">
              A calm, modern dental experience with online booking, experienced
              clinicians, and technology that puts your comfort first.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/book"
                className={buttonVariants({ size: "lg", className: "gap-2" })}
              >
                Book Appointment
                <ArrowRight className="size-4" />
              </Link>
              <Link
                href="/services"
                className={buttonVariants({ size: "lg", variant: "outline" })}
              >
                Explore services
              </Link>
            </div>

            <div className="mt-10 flex flex-wrap gap-6">
              {CLINIC_STATS.map((stat) => (
                <div key={stat.label}>
                  <p className="text-2xl font-bold text-primary">
                    {stat.value}
                  </p>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="animate-in-up delay-200">
            <div className="relative">
              <div className="overflow-hidden rounded-2xl border shadow-xl shadow-primary/5">
                <Image
                  src="https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=800&q=80"
                  alt="Modern dental clinic interior"
                  width={800}
                  height={600}
                  className="aspect-4/3 w-full object-cover"
                  priority
                />
              </div>

              <Card className="absolute -bottom-6 -left-4 w-56 shadow-lg sm:-left-8">
                <CardContent className="flex items-center gap-3 pt-4">
                  <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <CheckCircle2 className="size-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">4.9 rating</p>
                    <p className="text-xs text-muted-foreground">
                      500+ reviews
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="mt-10 grid gap-3 sm:grid-cols-3">
              {HIGHLIGHTS.map(({ icon: Icon, label }) => (
                <div
                  key={label}
                  className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3"
                >
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-4" />
                  </div>
                  <span className="text-sm font-medium">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
