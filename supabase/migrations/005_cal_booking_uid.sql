-- Store Cal.com booking UID for cancel/reschedule sync
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS cal_booking_uid TEXT;

CREATE INDEX IF NOT EXISTS idx_appointments_patient_phone ON appointments (patient_phone);
