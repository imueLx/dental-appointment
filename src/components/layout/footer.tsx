import Link from "next/link";
import { ArrowRight, Clock, Mail, MapPin, Phone } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Container } from "@/components/layout/container";
import { Logo } from "@/components/layout/logo";
import { CLINIC, NAV_LINKS, clinicPhoneTel } from "@/lib/constants";

export function Footer() {
  return (
    <footer className="mt-auto border-t bg-foreground text-background">
      <div className="border-b border-background/10">
        <Container>
          <div className="flex flex-col items-stretch justify-between gap-4 py-8 text-center sm:flex-row sm:items-center sm:py-10 sm:text-left">
            <div>
              <p className="text-lg font-semibold">Ready to visit us?</p>
              <p className="text-sm text-background/60">
                Book online in under two minutes.
              </p>
            </div>
            <Link
              href="/book"
              className={buttonVariants({
                size: "lg",
                className:
                  "h-12 w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90 sm:h-10 sm:w-auto",
              })}
            >
              Schedule now
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </Container>
      </div>

      <Container className="py-10 sm:py-12">
        <div className="grid gap-8 sm:grid-cols-2 sm:gap-10 lg:grid-cols-4">
          <div className="space-y-4">
            <Logo inverted showTagline={false} />
            <p className="text-sm text-background/60">{CLINIC.tagline}</p>
          </div>

          <div>
            <h3 className="mb-4 text-sm font-semibold">Quick links</h3>
            <ul className="space-y-3">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="inline-flex min-h-10 items-center text-sm text-background/60 transition-colors hover:text-background"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="mb-4 text-sm font-semibold">Contact</h3>
            <ul className="space-y-3 text-sm text-background/60">
              <li className="flex items-start gap-2.5">
                <Phone className="mt-0.5 size-4 shrink-0 text-primary" />
                <a
                  href={`tel:${clinicPhoneTel()}`}
                  className="hover:text-background"
                >
                  {CLINIC.phone}
                </a>
              </li>
              <li className="flex items-start gap-2.5">
                <Mail className="mt-0.5 size-4 shrink-0 text-primary" />
                <a
                  href={`mailto:${CLINIC.email}`}
                  className="hover:text-background"
                >
                  {CLINIC.email}
                </a>
              </li>
              <li className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
                <span>
                  {CLINIC.address}
                  <br />
                  {CLINIC.city}
                  <br />
                  {CLINIC.country}
                </span>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="mb-4 text-sm font-semibold">Hours</h3>
            <ul className="space-y-3 text-sm text-background/60">
              <li className="flex items-start gap-2.5">
                <Clock className="mt-0.5 size-4 shrink-0 text-primary" />
                <span>{CLINIC.hours}</span>
              </li>
              <li className="pl-6.5">Lunch: {CLINIC.lunchBreak}</li>
            </ul>
          </div>
        </div>

        <Separator className="my-8 bg-background/10" />

        <p className="text-center text-sm text-background/40">
          © {new Date().getFullYear()} {CLINIC.name}. All rights reserved.
        </p>
      </Container>
    </footer>
  );
}
