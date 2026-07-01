"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookingDialog } from "@/components/booking/booking-dialog";
import {
  type BookedSlot,
  formatDateKey,
  formatLunchLabel,
  formatSlotLabel,
  getScheduleGridRows,
  getWeekDates,
  isSlotBookable,
} from "@/lib/slots";
import { cn } from "@/lib/utils";

interface WeekScheduleGridProps {
  anchorDate: Date;
  bookedSlots: BookedSlot[];
}

const GRID_ROWS = getScheduleGridRows();

export function WeekScheduleGrid({
  anchorDate,
  bookedSlots,
}: WeekScheduleGridProps) {
  const weekDates = getWeekDates(anchorDate);
  const [selectedSlot, setSelectedSlot] = useState<{
    date: string;
    hour: number;
  } | null>(null);

  return (
    <>
      <div className="overflow-x-auto rounded-xl border border-border/60 bg-card shadow-sm">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="sticky left-0 z-10 bg-muted/40 px-3 py-3 text-left font-medium text-muted-foreground">
                Time
              </th>
              {weekDates.map((date) => (
                <th
                  key={formatDateKey(date)}
                  className="px-2 py-3 text-center font-medium"
                >
                  <div>{format(date, "EEE")}</div>
                  <div className="text-xs font-normal text-muted-foreground">
                    {format(date, "M/d")}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {GRID_ROWS.map((row) => {
              if (row.type === "lunch") {
                return (
                  <tr key="lunch" className="border-b bg-amber-50/60">
                    <td className="sticky left-0 z-10 bg-amber-50/60 px-3 py-2 text-xs font-medium text-amber-700">
                      Lunch
                    </td>
                    <td
                      colSpan={weekDates.length}
                      className="px-2 py-2 text-center text-xs font-medium text-amber-700"
                    >
                      {formatLunchLabel()} — Unavailable
                    </td>
                  </tr>
                );
              }

              const { hour } = row;
              return (
                <tr key={hour} className="border-b last:border-b-0">
                  <td className="sticky left-0 z-10 bg-card px-3 py-2 text-xs font-medium text-muted-foreground">
                    {formatSlotLabel(hour)}
                  </td>
                  {weekDates.map((date) => {
                    const dateKey = formatDateKey(date);
                    const bookable = isSlotBookable(date, hour, bookedSlots);
                    const booked = !bookable && !isSlotInPastOnly(date, hour, bookedSlots);

                    return (
                      <td key={dateKey} className="p-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!bookable}
                          onClick={() =>
                            bookable &&
                            setSelectedSlot({ date: dateKey, hour })
                          }
                          className={cn(
                            "h-10 w-full text-xs font-medium transition-colors",
                            bookable &&
                              "border-teal-200 bg-teal-50 text-teal-700 hover:bg-teal-100 hover:text-teal-800",
                            booked &&
                              "cursor-not-allowed border-transparent bg-muted text-muted-foreground opacity-70",
                            !bookable &&
                              !booked &&
                              "cursor-not-allowed border-transparent bg-muted/50 text-muted-foreground/50"
                          )}
                        >
                          {bookable ? (
                            "Available"
                          ) : booked ? (
                            <Badge variant="secondary" className="text-xs">
                              Booked
                            </Badge>
                          ) : (
                            "—"
                          )}
                        </Button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded border border-teal-200 bg-teal-50" />
          Available
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded bg-muted" />
          Booked
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded bg-amber-100" />
          Lunch break
        </span>
      </div>

      {selectedSlot && (
        <BookingDialog
          open={!!selectedSlot}
          onOpenChange={(open) => !open && setSelectedSlot(null)}
          appointmentDate={selectedSlot.date}
          startHour={selectedSlot.hour}
        />
      )}
    </>
  );
}

function isSlotInPastOnly(
  date: Date,
  hour: number,
  bookedSlots: BookedSlot[]
): boolean {
  const dateKey = formatDateKey(date);
  const isBooked = bookedSlots.some(
    (s) => s.appointment_date === dateKey && parseInt(s.start_time) === hour
  );
  if (isBooked) return false;
  return !isSlotBookable(date, hour, bookedSlots);
}
