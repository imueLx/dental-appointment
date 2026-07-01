"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { CalendarDays, Menu, Phone } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { navigationMenuTriggerStyle } from "@/components/ui/navigation-menu";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Container } from "@/components/layout/container";
import { Logo } from "@/components/layout/logo";
import { CLINIC, NAV_LINKS, clinicPhoneTel } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function Header() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  return (
    <header className="sticky top-0 z-50 border-b bg-background/90 backdrop-blur-xl supports-backdrop-filter:bg-background/75">
      <Container>
        <div className="flex h-14 items-center justify-between gap-3 sm:h-16">
          <Logo />

          <nav className="hidden items-center gap-0.5 md:flex" aria-label="Main">
            {NAV_LINKS.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    navigationMenuTriggerStyle(),
                    active && "bg-accent text-accent-foreground font-medium"
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <Link
              href={`tel:${clinicPhoneTel()}`}
              className="hidden items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:text-primary lg:inline-flex"
              aria-label="Call clinic"
            >
              <Phone className="size-4" />
              <span className="hidden xl:inline">{CLINIC.phone}</span>
            </Link>

            <Link
              href="/book"
              className={buttonVariants({
                size: "sm",
                className: "h-9 gap-1.5 px-3 sm:h-9 sm:px-4",
              })}
            >
              <CalendarDays className="size-4 md:hidden" />
              <span className="md:hidden">Book</span>
              <span className="hidden md:inline">Book Appointment</span>
            </Link>

            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger
                render={
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-10 md:hidden"
                    aria-label="Open menu"
                  />
                }
              >
                <Menu className="size-5" />
              </SheetTrigger>
              <SheetContent
                side="right"
                className="w-full max-w-sm gap-0 p-0 sm:max-w-xs"
              >
                <SheetTitle className="sr-only">Navigation menu</SheetTitle>
                <div className="border-b px-5 pb-4 pt-5">
                  <Logo showTagline />
                </div>

                <div className="flex flex-1 flex-col overflow-y-auto px-4 py-4">
                  <Link
                    href={`tel:${clinicPhoneTel()}`}
                    className="mb-4 flex min-h-12 items-center gap-3 rounded-xl border bg-muted/40 px-4 text-sm font-medium transition-colors active:bg-muted"
                    onClick={() => setMenuOpen(false)}
                  >
                    <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Phone className="size-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-xs text-muted-foreground">
                        Call us
                      </span>
                      {CLINIC.phone}
                    </span>
                  </Link>

                  <nav className="flex flex-col gap-1" aria-label="Mobile">
                    {NAV_LINKS.map((link) => {
                      const active = pathname === link.href;
                      return (
                        <Link
                          key={link.href}
                          href={link.href}
                          onClick={() => setMenuOpen(false)}
                          className={cn(
                            "flex min-h-12 items-center rounded-xl px-4 text-base font-medium transition-colors active:scale-[0.99]",
                            active
                              ? "bg-accent text-accent-foreground"
                              : "hover:bg-muted active:bg-muted"
                          )}
                        >
                          {link.label}
                        </Link>
                      );
                    })}
                  </nav>

                  <Separator className="my-4" />

                  <Link
                    href="/book"
                    onClick={() => setMenuOpen(false)}
                    className={buttonVariants({
                      size: "lg",
                      className: "h-12 w-full gap-2 shadow-md shadow-primary/20",
                    })}
                  >
                    <CalendarDays className="size-4" />
                    Book Appointment
                  </Link>
                </div>

                <div className="border-t px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-center text-xs text-muted-foreground">
                  {CLINIC.hours}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </Container>
    </header>
  );
}
