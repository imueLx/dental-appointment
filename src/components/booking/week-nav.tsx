"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { addWeeks, format, subWeeks } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getWeekDates } from "@/lib/slots";

interface WeekNavProps {
  anchorDate: Date;
}

export function WeekNav({ anchorDate }: WeekNavProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const weekDates = getWeekDates(anchorDate);

  function navigate(weekStart: Date) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("week", format(weekStart, "yyyy-MM-dd"));
    router.push(`/book?${params.toString()}`);
  }

  const label = `${format(weekDates[0], "MMM d")} – ${format(weekDates[4], "MMM d, yyyy")}`;

  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={() => navigate(subWeeks(weekDates[0], 1))}
          aria-label="Previous week"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={() => navigate(addWeeks(weekDates[0], 1))}
          aria-label="Next week"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(new Date())}
        >
          Today
        </Button>
      </div>
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
    </div>
  );
}
