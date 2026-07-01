import nodemailer from "nodemailer";
import { CLINIC } from "@/lib/constants";
import { formatClinicDate } from "@/lib/locale";
import { formatSlotRange } from "@/lib/slots";

export interface BookingConfirmationPayload {
  patientEmail: string;
  patientName?: string;
  appointmentDate: string;
  startHour: number;
}

export function isSmtpConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS
  );
}

function getTransporter() {
  const host = process.env.SMTP_HOST ?? "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT ?? 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) {
    throw new Error("SMTP credentials are not configured");
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

function formatAppointmentDate(dateKey: string): string {
  const d = new Date(dateKey + "T12:00:00");
  return formatClinicDate(d, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function buildConfirmationHtml(payload: BookingConfirmationPayload): string {
  const dateLabel = formatAppointmentDate(payload.appointmentDate);
  const timeLabel = formatSlotRange(payload.startHour);
  const greeting = payload.patientName
    ? `Hi ${payload.patientName},`
    : "Hi there,";

  return `
    <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;color:#1a1a1a">
      <h1 style="font-size:20px;margin-bottom:8px">Appointment confirmed</h1>
      <p style="color:#555;line-height:1.5">${greeting}</p>
      <p style="color:#555;line-height:1.5">Your visit at <strong>${CLINIC.name}</strong> is scheduled:</p>
      <div style="background:#f4fafa;border:1px solid #cce8e4;border-radius:12px;padding:16px;margin:20px 0">
        <p style="margin:0 0 8px"><strong>Date:</strong> ${dateLabel}</p>
        <p style="margin:0 0 8px"><strong>Time:</strong> ${timeLabel} (PHT)</p>
        <p style="margin:0"><strong>Location:</strong> ${CLINIC.address}, ${CLINIC.city}</p>
      </div>
      <p style="color:#555;line-height:1.5">Lunch break: ${CLINIC.lunchBreak}. Please arrive a few minutes early.</p>
      <p style="color:#555;line-height:1.5">Need to reschedule? Reply to this email or call us at ${CLINIC.phone}.</p>
      <p style="color:#888;font-size:13px;margin-top:24px">${CLINIC.name} · ${CLINIC.email}</p>
    </div>
  `;
}

export async function sendBookingConfirmationEmail(
  payload: BookingConfirmationPayload
): Promise<{ sent: boolean; error?: string }> {
  if (!payload.patientEmail.trim()) {
    return { sent: false };
  }

  if (!isSmtpConfigured()) {
    return { sent: false, error: "Email is not configured on the server" };
  }

  const from =
    process.env.SMTP_FROM ?? `${CLINIC.name} <${process.env.SMTP_USER}>`;
  const dateLabel = formatAppointmentDate(payload.appointmentDate);
  const timeLabel = formatSlotRange(payload.startHour);

  try {
    const transporter = getTransporter();
    await transporter.sendMail({
      from,
      to: payload.patientEmail,
      subject: `Appointment confirmed — ${dateLabel} at ${timeLabel}`,
      html: buildConfirmationHtml(payload),
      text: [
        `Your appointment at ${CLINIC.name} is confirmed.`,
        `Date: ${dateLabel}`,
        `Time: ${timeLabel} (PHT)`,
        `Location: ${CLINIC.address}, ${CLINIC.city}`,
        `Phone: ${CLINIC.phone}`,
      ].join("\n"),
    });
    return { sent: true };
  } catch (err) {
    console.error("Failed to send booking confirmation email:", err);
    return {
      sent: false,
      error: "Could not send confirmation email. Please save your appointment details.",
    };
  }
}
