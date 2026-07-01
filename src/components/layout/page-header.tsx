import { cn } from "@/lib/utils";

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  centered?: boolean;
  className?: string;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  centered = false,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border bg-card px-5 py-8 sm:px-10 sm:py-12",
        centered && "text-center",
        className
      )}
    >
      <div className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-primary/5 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-10 size-40 rounded-full bg-primary/5 blur-3xl" />
      <div className={cn("relative", centered && "mx-auto max-w-2xl")}>
        {eyebrow && (
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">
            {eyebrow}
          </p>
        )}
        <h1 className="text-2xl font-bold tracking-tight sm:text-4xl">{title}</h1>
        {description && (
          <p className="mt-2 text-sm text-muted-foreground sm:mt-3 sm:text-lg">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}
