"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  format,
  isWeekend,
  parseISO,
  startOfMonth,
} from "date-fns";
import type { DayButton } from "react-day-picker";
import { CalendarIcon, ChevronRight, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BookingDialog } from "@/components/booking/booking-dialog";
import { BOOKING_CONFIRMED_EVENT } from "@/lib/cal";
import { CLINIC, CLINIC_TIMEZONE } from "@/lib/constants";
import { formatClinicDate } from "@/lib/locale";
import {
  BOOKING_WINDOW_DAYS,
  buildLocalSlotIso,
  findFirstAvailableDate,
  formatDateKey,
  formatLunchLabel,
  formatSlotRange,
  getBookingEndDate,
  getBookingStartDate,
  getScheduleGridRows,
  isBookableCalendarDay,
  isSlotInPast,
  openCountsForRange,
  openHoursForDate,
  type BookedSlot,
} from "@/lib/slots";
import { cn } from "@/lib/utils";

const bookingStart = getBookingStartDate();
const bookingEnd = getBookingEndDate();
const windowFrom = formatDateKey(bookingStart);
const windowTo = formatDateKey(bookingEnd);

function emptyBooked(): BookedSlot[] {
  return [];
}

export function DaySlotPicker() {
  const [selectedDate, setSelectedDate] = useState(() =>
    formatDateKey(bookingStart)
  );
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(bookingStart));
  const [bookedSlots, setBookedSlots] = useState<BookedSlot[]>(emptyBooked);
  const [syncing, setSyncing] = useState(true);
  const [bookingSlot, setBookingSlot] = useState<{
    hour: number;
    iso?: string;
  } | null>(null);
  const [hasAutoSelected, setHasAutoSelected] = useState(false);
  const timesSectionRef = useRef<HTMLDivElement>(null);

  const monthAvailability = useMemo(
    () => openCountsForRange(windowFrom, windowTo, bookedSlots),
    [bookedSlots]
  );

  const availableHours = useMemo(
    () => new Set(openHoursForDate(selectedDate, bookedSlots)),
    [selectedDate, bookedSlots]
  );

  const slotTimes = useMemo(() => {
    const map: Record<string, string> = {};
    for (const hour of availableHours) {
      map[String(hour)] = buildLocalSlotIso(
        selectedDate,
        hour,
        CLINIC_TIMEZONE
      );
    }
    return map;
  }, [availableHours, selectedDate]);

  const loadBooked = useCallback(async () => {
    setSyncing(true);
    try {
      const res = await fetch(
        `/api/availability?from=${windowFrom}&to=${windowTo}`,
        { cache: "no-store" }
      );
      if (!res.ok) return;
      const data = (await res.json()) as { slots?: BookedSlot[] };
      setBookedSlots(data.slots ?? []);
    } catch {
      // Keep last known / empty booked — local hours still show instantly
    } finally {
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    void loadBooked();
  }, [loadBooked]);

  useEffect(() => {
    if (hasAutoSelected) return;
    const first = findFirstAvailableDate(monthAvailability);
    setSelectedDate(first);
    setHasAutoSelected(true);
  }, [monthAvailability, hasAutoSelected]);

  useEffect(() => {
    const refresh = () => {
      void loadBooked();
    };
    window.addEventListener(BOOKING_CONFIRMED_EVENT, refresh);
    return () => window.removeEventListener(BOOKING_CONFIRMED_EVENT, refresh);
  }, [loadBooked]);

  const dateObj = parseISO(selectedDate + "T12:00:00");
  const weekend = isWeekend(dateObj);
  const rows = getScheduleGridRows();

  function isOpen(hour: number): boolean {
    if (weekend || isSlotInPast(dateObj, hour)) return false;
    return availableHours.has(hour);
  }

  const displayDate = formatClinicDate(dateObj);
  const shortDate = formatClinicDate(dateObj, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  const openCount = rows.filter(
    (r) => r.type === "slot" && isOpen(r.hour)
  ).length;

  function getOpenCount(dateKey: string): number {
    return monthAvailability[dateKey] ?? 0;
  }

  const slotCountLabel =
    openCount === 1 ? "1 time available" : `${openCount} times available`;

  function handleDateSelect(date: Date | undefined) {
    if (!date) return;
    setSelectedDate(format(date, "yyyy-MM-dd"));
    if (window.matchMedia("(max-width: 1023px)").matches) {
      window.requestAnimationFrame(() => {
        timesSectionRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    }
  }

  return (
    <>
      <div className="mx-auto max-w-5xl space-y-4 lg:space-y-0">
        <div className="flex gap-2 lg:hidden">
          <StepChip step={1} label="Pick a date" active />
          <StepChip
            step={2}
            label="Choose a time"
            active={!weekend && openCount > 0}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-2 lg:items-start lg:gap-6">
          <Card className="overflow-hidden">
            <CardHeader className="px-4 pb-3 pt-4 sm:px-6 sm:pt-6">
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarIcon className="size-4 text-primary" />
                Select a date
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Starts tomorrow · {BOOKING_WINDOW_DAYS} days ahead · Lunch{" "}
                {CLINIC.lunchBreak}
                {syncing ? " · Syncing…" : ""}
              </CardDescription>
            </CardHeader>
            <CardContent className="px-3 pb-4 sm:px-6 sm:pb-6">
              <div className="mb-3 grid grid-cols-2 gap-x-3 gap-y-2 text-[11px] text-muted-foreground sm:mb-4 sm:flex sm:flex-wrap sm:gap-4 sm:text-xs">
                <span className="flex items-center gap-1.5">
                  <span className="size-2 shrink-0 rounded-full bg-primary" />
                  Available
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2 shrink-0 rounded-full bg-muted-foreground/25" />
                  Full
                </span>
                <span className="col-span-2 flex items-center gap-1.5 sm:col-span-1">
                  <span className="size-2 shrink-0 rounded-full bg-transparent ring-1 ring-border" />
                  Not bookable
                </span>
              </div>

              <div className="relative flex justify-center">
                <Calendar
                  mode="single"
                  selected={dateObj}
                  month={viewMonth}
                  onMonthChange={setViewMonth}
                  startMonth={startOfMonth(bookingStart)}
                  endMonth={startOfMonth(bookingEnd)}
                  onSelect={handleDateSelect}
                  disabled={(date) => !isBookableCalendarDay(date)}
                  showOutsideDays={false}
                  className="w-full [--cell-size:2.625rem] min-[380px]:[--cell-size:2.875rem] sm:[--cell-size:3.25rem] md:[--cell-size:3.5rem]"
                  classNames={{
                    root: "w-full",
                    month: "w-full gap-3 sm:gap-4",
                    month_grid: "w-full",
                    weekdays: "w-full",
                    week: "w-full",
                    day: "flex-1",
                    caption_label: "text-sm font-semibold sm:text-base",
                    weekday:
                      "flex-1 text-center text-[10px] font-medium sm:text-xs",
                    button_previous: "size-9 touch-manipulation sm:size-8",
                    button_next: "size-9 touch-manipulation sm:size-8",
                  }}
                  components={{
                    DayButton: (props) => (
                      <AvailabilityDayButton
                        {...props}
                        openCount={getOpenCount(
                          format(props.day.date, "yyyy-MM-dd")
                        )}
                        bookable={isBookableCalendarDay(props.day.date)}
                      />
                    ),
                  }}
                />
              </div>
            </CardContent>
          </Card>

          <Card
            ref={timesSectionRef}
            className="scroll-mt-20 overflow-hidden lg:scroll-mt-24"
          >
            <CardHeader className="sticky top-14 z-10 border-b bg-card/95 px-4 py-3 backdrop-blur-sm sm:static sm:border-0 sm:bg-transparent sm:px-6 sm:py-0 sm:pt-6 lg:top-16">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <CardTitle className="truncate text-base sm:text-lg">
                    {displayDate}
                  </CardTitle>
                  <CardDescription className="mt-0.5 text-xs sm:mt-1 sm:text-sm">
                    Tap a time to continue
                  </CardDescription>
                </div>
                {!weekend && openCount > 0 && (
                  <Badge variant="secondary" className="shrink-0 gap-1 text-xs">
                    <Clock className="size-3" />
                    <span className="hidden min-[380px]:inline">
                      {slotCountLabel}
                    </span>
                    <span className="min-[380px]:hidden">{openCount}</span>
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="px-3 pb-4 sm:px-6 sm:pb-6">
              {weekend ? (
                <div className="rounded-xl bg-muted px-4 py-8 text-center sm:py-10">
                  <p className="text-sm font-medium">Closed on weekends</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Please choose a weekday.
                  </p>
                </div>
              ) : openCount === 0 ? (
                <div className="rounded-xl bg-muted px-4 py-8 text-center sm:py-10">
                  <p className="text-sm font-medium">No times available</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Try another date on the calendar.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {rows.map((row) => {
                    if (row.type === "lunch") {
                      return (
                        <div
                          key="lunch"
                          className="flex items-center justify-between gap-2 rounded-xl border border-dashed bg-muted/50 px-3 py-3 sm:px-4"
                        >
                          <span className="text-xs font-medium text-muted-foreground sm:text-sm">
                            {formatLunchLabel()}
                          </span>
                          <Badge
                            variant="outline"
                            className="shrink-0 text-[10px] sm:text-xs"
                          >
                            Lunch
                          </Badge>
                        </div>
                      );
                    }

                    const { hour } = row;
                    const past = isSlotInPast(dateObj, hour);
                    const open = isOpen(hour);

                    return (
                      <Button
                        key={hour}
                        type="button"
                        variant={open ? "default" : "outline"}
                        disabled={!open}
                        onClick={() =>
                          open &&
                          setBookingSlot({
                            hour,
                            iso: slotTimes[String(hour)],
                          })
                        }
                        className={cn(
                          "group h-auto min-h-14 w-full touch-manipulation justify-between gap-2 px-3 py-3 text-left font-normal transition-all sm:gap-3 sm:px-4 sm:py-4",
                          open &&
                            "cursor-pointer border-2 border-primary/50 bg-primary text-primary-foreground shadow-md shadow-primary/20 hover:border-primary hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/25 active:scale-[0.99]",
                          !open && "cursor-not-allowed opacity-50"
                        )}
                      >
                        <div className="min-w-0">
                          <span
                            className={cn(
                              "block text-sm font-semibold sm:text-base",
                              open
                                ? "text-primary-foreground"
                                : "text-muted-foreground"
                            )}
                          >
                            {formatSlotRange(hour)}
                          </span>
                          {open && (
                            <span className="mt-0.5 hidden text-xs text-primary-foreground/80 sm:block">
                              Tap to book this time
                            </span>
                          )}
                        </div>
                        {open ? (
                          <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-primary-foreground/15 px-2.5 py-1.5 text-xs font-semibold text-primary-foreground ring-1 ring-primary-foreground/20 group-hover:bg-primary-foreground/25 sm:py-1">
                            Book
                            <ChevronRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                          </span>
                        ) : past ? (
                          <Badge variant="secondary" className="shrink-0">
                            Past
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="shrink-0">
                            Taken
                          </Badge>
                        )}
                      </Button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {!weekend && openCount > 0 && (
          <p className="text-center text-xs text-muted-foreground lg:hidden">
            {shortDate} · {slotCountLabel}
          </p>
        )}
      </div>

      {bookingSlot && (
        <BookingDialog
          open={!!bookingSlot}
          onOpenChange={(open) => !open && setBookingSlot(null)}
          appointmentDate={selectedDate}
          startHour={bookingSlot.hour}
          slotIso={bookingSlot.iso}
        />
      )}
    </>
  );
}

function StepChip({
  step,
  label,
  active,
}: {
  step: number;
  label: string;
  active?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-1 items-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-medium",
        active
          ? "border-primary/30 bg-primary/5 text-foreground"
          : "border-border bg-muted/30 text-muted-foreground"
      )}
    >
      <span
        className={cn(
          "flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
          active
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground"
        )}
      >
        {step}
      </span>
      {label}
    </div>
  );
}

function AvailabilityDayButton({
  day,
  modifiers,
  openCount,
  bookable,
  className,
  ...props
}: React.ComponentProps<typeof DayButton> & {
  openCount: number;
  bookable: boolean;
}) {
  const isDisabled = modifiers.disabled && !modifiers.outside;
  const isOutside = modifiers.outside;
  const isSelected = modifiers.selected;
  const hasSlots = bookable && openCount > 0;
  const noSlots = bookable && openCount === 0;

  return (
    <Button
      variant="ghost"
      size="icon"
      data-day={day.date.toLocaleDateString()}
      data-selected-single={isSelected}
      className={cn(
        "relative flex aspect-square h-auto w-full min-w-0 touch-manipulation flex-col gap-0.5 rounded-lg p-0.5 font-normal sm:gap-1 sm:p-1",
        isSelected && "bg-primary text-primary-foreground hover:bg-primary/90",
        !isSelected && hasSlots && "hover:bg-primary/10",
        noSlots && "text-muted-foreground",
        (isDisabled || !bookable) && !isOutside && "opacity-40",
        isOutside && "opacity-30",
        className
      )}
      {...props}
    >
      <span className="text-sm font-semibold leading-none sm:text-base">
        {day.date.getDate()}
      </span>
      {hasSlots && !isSelected && (
        <span className="size-1.5 rounded-full bg-primary" />
      )}
      {hasSlots && isSelected && (
        <span className="size-1.5 rounded-full bg-primary-foreground" />
      )}
    </Button>
  );
}
