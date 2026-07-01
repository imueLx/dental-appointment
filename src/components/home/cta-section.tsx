import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";

export function CtaSection() {
  return (
    <Section variant="primary" className="relative overflow-hidden">
      <div className="pointer-events-none absolute -right-20 top-0 size-64 rounded-full bg-primary-foreground/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-10 size-48 rounded-full bg-primary-foreground/5 blur-3xl" />

      <Container className="relative text-center">
        <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
          Your next visit is just a click away
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-primary-foreground/80">
          Book online anytime. Choose your service, pick a time, and get instant
          confirmation.
        </p>
        <Link
          href="/book"
          className={buttonVariants({
            size: "lg",
            className:
              "mt-8 gap-2 bg-primary-foreground text-primary hover:bg-primary-foreground/90",
          })}
        >
          Schedule now
          <ArrowRight className="size-4" />
        </Link>
      </Container>
    </Section>
  );
}
