"use client";

import { useEffect, useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  Mail,
  MapPin,
  Phone,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { bookAppointment } from "@/actions/book-appointment";
import { sendBookingConfirmation } from "@/actions/send-booking-confirmation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { dispatchBookingConfirmed } from "@/lib/cal";
import { CLINIC, CLINIC_LOCATIONS, SERVICE_NAMES, clinicPhoneTel, getClinicLocationById, type ClinicLocationId } from "@/lib/constants";
import { formatClinicDate } from "@/lib/locale";
import { formatSlotRange } from "@/lib/slots";
import { bookingSchema, type BookingFormData } from "@/lib/validators";
import { cn } from "@/lib/utils";

interface BookingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointmentDate: string;
  startHour: number;
  slotIso?: string;
}

type Step = "form" | "success";

const EMPTY_SERVICE = "";
const DEFAULT_LOCATION_ID = CLINIC_LOCATIONS[0].id;

export function BookingDialog({
  open,
  onOpenChange,
  appointmentDate,
  startHour,
  slotIso,
}: BookingDialogProps) {
  const [step, setStep] = useState<Step>("form");
  const [isPending, startTransition] = useTransition();
  const [emailSent, setEmailSent] = useState(false);
  const [calSynced, setCalSynced] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [submittedName, setSubmittedName] = useState("");
  const [submittedLocationId, setSubmittedLocationId] =
    useState<ClinicLocationId>(DEFAULT_LOCATION_ID);

  const dateLabel = formatClinicDate(
    new Date(appointmentDate + "T12:00:00"),
    {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    }
  );
  const timeLabel = formatSlotRange(startHour);

  const form = useForm<BookingFormData>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      appointmentDate,
      startHour,
      clinicLocationId: DEFAULT_LOCATION_ID,
      patientName: "",
      patientEmail: "",
      patientPhone: "",
      service: EMPTY_SERVICE,
      notes: "",
    },
  });

  const selectedLocationId = form.watch("clinicLocationId") || DEFAULT_LOCATION_ID;
  const selectedLocation = getClinicLocationById(selectedLocationId);

  useEffect(() => {
    if (!open) {
      setStep("form");
      setEmailSent(false);
      setCalSynced(false);
      setSubmittedEmail("");
      setSubmittedName("");
      setSubmittedLocationId(DEFAULT_LOCATION_ID);
      return;
    }
    form.reset({
      appointmentDate,
      startHour,
      clinicLocationId: DEFAULT_LOCATION_ID,
      patientName: "",
      patientEmail: "",
      patientPhone: "",
      service: EMPTY_SERVICE,
      notes: "",
    });
  }, [open, appointmentDate, startHour, form]);

  function handleClose(nextOpen: boolean) {
    if (!nextOpen) setStep("form");
    onOpenChange(nextOpen);
  }

  function onSubmit(values: BookingFormData) {
    startTransition(async () => {
      const result = await bookAppointment(values, { slotIso });
      if (!result.success) {
        toast.error(result.error);
        return;
      }

      dispatchBookingConfirmed();
      setSubmittedName(values.patientName);
      setSubmittedLocationId(values.clinicLocationId as ClinicLocationId);
      setSubmittedEmail(values.patientEmail?.trim() ?? "");
      setCalSynced(result.calSynced);
      setStep("success");

      const email = values.patientEmail?.trim();
      if (email) {
        const emailResult = await sendBookingConfirmation({
          patientEmail: email,
          patientName: values.patientName,
          appointmentDate: values.appointmentDate,
          startHour: values.startHour,
        });
        if (emailResult.sent) {
          setEmailSent(true);
          toast.success("Appointment confirmed!", {
            description: `Confirmation sent to ${email}`,
          });
        } else if (!emailResult.skipped) {
          toast.success("Appointment confirmed!", {
            description: emailResult.error,
          });
        } else {
          toast.success("Appointment confirmed!");
        }
      } else {
        toast.success("Appointment confirmed!", {
          description: `${dateLabel} at ${timeLabel}`,
        });
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className={cn(
          "flex max-h-none flex-col gap-0 overflow-hidden p-0",
          "max-sm:fixed max-sm:inset-0 max-sm:h-dvh max-sm:max-w-none max-sm:translate-none max-sm:rounded-none max-sm:border-0",
          "sm:max-h-[min(90dvh,640px)] sm:max-w-lg"
        )}
      >
        <div className="relative shrink-0 border-b bg-linear-to-br from-primary/10 via-background to-background px-4 pb-4 pt-5 pt-safe sm:px-6 sm:pb-5 sm:pt-6">
          <div className="pointer-events-none absolute -right-8 -top-8 size-32 rounded-full bg-primary/10 blur-2xl" />
          {step === "form" ? (
            <DialogHeader className="relative text-left">
              <div className="mb-2 flex items-center gap-2 sm:mb-3">
                <Badge variant="secondary" className="gap-1 rounded-full px-2.5">
                  <Sparkles className="size-3 text-primary" />
                  Confirm booking
                </Badge>
              </div>
              <DialogTitle className="text-lg font-semibold tracking-tight sm:text-xl">
                Almost there
              </DialogTitle>
              <DialogDescription className="text-sm">
                Review your visit details and enter your information below.
              </DialogDescription>
            </DialogHeader>
          ) : (
            <DialogHeader className="relative text-center">
              <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25 sm:size-14">
                <CheckCircle2 className="size-6 sm:size-7" />
              </div>
              <DialogTitle className="text-lg font-semibold sm:text-xl">
                You&apos;re booked!
              </DialogTitle>
              <DialogDescription className="text-sm">
                We&apos;ve saved your appointment and look forward to seeing you.
              </DialogDescription>
            </DialogHeader>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-5">
          {step === "form" ? (
            <>
              <AppointmentSummary
                dateLabel={dateLabel}
                timeLabel={timeLabel}
                locationLabel={selectedLocation.label}
                locationAddress={selectedLocation.address}
                compact
              />

              <Form {...form}>
                <form
                  id="booking-form"
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-4"
                >
                  <FormField
                    control={form.control}
                    name="clinicLocationId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Clinic branch</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger className="h-12 w-full touch-manipulation sm:h-11">
                              <SelectValue placeholder="Select a branch" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {CLINIC_LOCATIONS.map((loc) => (
                              <SelectItem key={loc.id} value={loc.id}>
                                {loc.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="patientName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full name</FormLabel>
                        <FormControl>
                          <Input
                            className="h-12 touch-manipulation sm:h-11"
                            placeholder="Juan Dela Cruz"
                            autoComplete="name"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="patientPhone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone</FormLabel>
                          <FormControl>
                            <Input
                              type="tel"
                              inputMode="tel"
                              className="h-12 touch-manipulation sm:h-11"
                              placeholder={CLINIC.phonePlaceholder}
                              autoComplete="tel"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="patientEmail"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email (optional)</FormLabel>
                          <FormControl>
                            <Input
                              type="email"
                              inputMode="email"
                              className="h-12 touch-manipulation sm:h-11"
                              placeholder="you@example.com"
                              autoComplete="email"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="service"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Service</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger className="h-12 w-full touch-manipulation sm:h-11">
                              <SelectValue placeholder="Select a service" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {SERVICE_NAMES.map((name) => (
                              <SelectItem key={name} value={name}>
                                {name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes (optional)</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Any special requests or concerns..."
                            className="min-h-[80px] resize-none sm:min-h-[88px]"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <input type="hidden" {...form.register("appointmentDate")} />
                  <input
                    type="hidden"
                    {...form.register("startHour", { valueAsNumber: true })}
                  />

                  <Button
                    type="submit"
                    size="lg"
                    className="hidden h-12 w-full shadow-md shadow-primary/20 sm:flex sm:h-11"
                    disabled={isPending}
                  >
                    {isPending ? "Confirming..." : "Confirm appointment"}
                  </Button>
                </form>
              </Form>
            </>
          ) : (
            <div className="space-y-4 sm:space-y-5">
              <AppointmentSummary
                dateLabel={dateLabel}
                timeLabel={timeLabel}
                locationLabel={getClinicLocationById(submittedLocationId).label}
                locationAddress={getClinicLocationById(submittedLocationId).address}
                patientName={submittedName}
                highlight
                compact
              />

              <div className="space-y-2 rounded-xl border bg-muted/30 p-4 text-sm">
                {calSynced && (
                  <p className="flex items-center gap-2 text-foreground">
                    <CheckCircle2 className="size-4 shrink-0 text-primary" />
                    Synced to clinic calendar (Cal.com)
                  </p>
                )}
                {submittedEmail && (
                  <p className="flex items-start gap-2 text-muted-foreground">
                    <Mail className="mt-0.5 size-4 shrink-0 text-primary" />
                    {emailSent
                      ? `Confirmation emailed to ${submittedEmail}`
                      : `Couldn't email ${submittedEmail} — please save these details.`}
                  </p>
                )}
              </div>

              <Button
                size="lg"
                className="hidden h-12 w-full sm:flex sm:h-11"
                onClick={() => handleClose(false)}
              >
                Done
              </Button>
            </div>
          )}
        </div>

        {step === "form" ? (
          <div className="shrink-0 border-t bg-background/95 px-4 py-3 pb-safe backdrop-blur-sm sm:hidden">
            <Button
              type="submit"
              form="booking-form"
              size="lg"
              className="h-12 w-full touch-manipulation shadow-md shadow-primary/20"
              disabled={isPending}
            >
              {isPending ? "Confirming..." : "Confirm appointment"}
            </Button>
          </div>
        ) : (
          <div className="shrink-0 border-t bg-background/95 px-4 py-3 pb-safe backdrop-blur-sm sm:hidden">
            <Button
              size="lg"
              className="h-12 w-full touch-manipulation"
              onClick={() => handleClose(false)}
            >
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function AppointmentSummary({
  dateLabel,
  timeLabel,
  locationLabel,
  locationAddress,
  patientName,
  highlight = false,
  compact = false,
}: {
  dateLabel: string;
  timeLabel: string;
  locationLabel: string;
  locationAddress: string;
  patientName?: string;
  highlight?: boolean;
  compact?: boolean;
}) {
  const items = [
    { icon: CalendarDays, label: "Date", value: dateLabel },
    { icon: Clock3, label: "Time", value: timeLabel, emphasis: true },
    {
      icon: MapPin,
      label: "Branch",
      value: locationLabel,
      sub: locationAddress,
    },
    { icon: Phone, label: "Clinic", value: CLINIC.phone, href: true },
  ] as const;

  return (
    <div
      className={cn(
        "mb-4 overflow-hidden rounded-2xl border sm:mb-5",
        highlight ? "bg-primary/5 ring-1 ring-primary/15" : "bg-muted/20"
      )}
    >
      <div className="border-b bg-background/60 px-3 py-2.5 sm:px-4 sm:py-3">
        <p className="text-sm font-semibold">{CLINIC.name}</p>
        <p className="text-xs text-muted-foreground">{CLINIC.country}</p>
      </div>

      {compact ? (
        <div className="grid grid-cols-2 gap-2 p-3 sm:hidden">
          {items.slice(0, 2).map(({ icon: Icon, label, value, ...rest }) => (
            <div
              key={label}
              className="rounded-xl border bg-background/80 p-2.5"
            >
              <div className="mb-1 flex items-center gap-1.5 text-primary">
                <Icon className="size-3.5" />
                <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {label}
                </span>
              </div>
              <p
                className={cn(
                  "text-xs font-medium leading-snug text-foreground",
                  "emphasis" in rest && rest.emphasis && "font-semibold text-primary"
                )}
              >
                {value}
              </p>
            </div>
          ))}
          <div className="col-span-2 rounded-xl border bg-background/80 p-2.5">
            <div className="mb-1 flex items-center gap-1.5 text-primary">
              <MapPin className="size-3.5" />
              <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Branch
              </span>
            </div>
            <p className="text-xs font-medium text-foreground">{locationLabel}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {locationAddress}
            </p>
          </div>
          <div className="col-span-2 rounded-xl border bg-background/80 p-2.5">
            <div className="mb-1 flex items-center gap-1.5 text-primary">
              <Phone className="size-3.5" />
              <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Clinic
              </span>
            </div>
            <a
              href={`tel:${clinicPhoneTel()}`}
              className="text-xs font-medium text-foreground hover:text-primary"
            >
              {CLINIC.phone}
            </a>
          </div>
        </div>
      ) : null}

      <div
        className={cn(
          "grid gap-px bg-border/60 p-px",
          compact && "hidden sm:grid"
        )}
      >
        {items.map(({ icon: Icon, label, value, ...rest }) => (
          <div
            key={label}
            className="flex items-start gap-3 bg-background/80 px-4 py-3 text-sm"
          >
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="size-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {label}
              </p>
              {"href" in rest && rest.href ? (
                <a
                  href={`tel:${clinicPhoneTel()}`}
                  className="font-medium text-foreground hover:text-primary"
                >
                  {value}
                </a>
              ) : (
                <div>
                  <p
                    className={cn(
                      "text-foreground",
                      "emphasis" in rest && rest.emphasis && "font-semibold text-primary"
                    )}
                  >
                    {value}
                  </p>
                  {"sub" in rest && rest.sub && (
                    <p className="mt-0.5 text-xs text-muted-foreground">{rest.sub}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      {patientName && (
        <div className="border-t bg-background/60 px-4 py-3 text-sm text-muted-foreground">
          Booked for{" "}
          <span className="font-medium text-foreground">{patientName}</span>
        </div>
      )}
    </div>
  );
}
