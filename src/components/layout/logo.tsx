import Link from "next/link";
import { Smile } from "lucide-react";
import { CLINIC } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  showTagline?: boolean;
  inverted?: boolean;
}

export function Logo({
  className,
  showTagline = true,
  inverted = false,
}: LogoProps) {
  return (
    <Link
      href="/"
      className={cn(
        "group flex items-center gap-2.5 transition-opacity hover:opacity-90",
        className
      )}
    >
      <div
        className={cn(
          "flex size-9 items-center justify-center rounded-xl shadow-sm",
          inverted
            ? "bg-primary-foreground text-primary"
            : "bg-primary text-primary-foreground"
        )}
      >
        <Smile className="size-5" strokeWidth={2.25} />
      </div>
      <div className="hidden sm:block">
        <span
          className={cn(
            "block text-sm font-semibold leading-tight tracking-tight",
            inverted ? "text-primary-foreground" : "text-foreground"
          )}
        >
          {CLINIC.name}
        </span>
        {showTagline && (
          <span
            className={cn(
              "block text-[11px]",
              inverted
                ? "text-primary-foreground/60"
                : "text-muted-foreground"
            )}
          >
            Dental Care
          </span>
        )}
      </div>
    </Link>
  );
}
