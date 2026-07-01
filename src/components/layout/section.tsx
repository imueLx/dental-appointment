import { cn } from "@/lib/utils";

interface SectionProps {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "muted" | "primary" | "dark";
  id?: string;
}

const variants = {
  default: "bg-background",
  muted: "bg-muted/40",
  primary: "bg-primary text-primary-foreground",
  dark: "bg-foreground text-background",
};

export function Section({
  children,
  className,
  variant = "default",
  id,
}: SectionProps) {
  return (
    <section id={id} className={cn("py-16 sm:py-24", variants[variant], className)}>
      {children}
    </section>
  );
}
