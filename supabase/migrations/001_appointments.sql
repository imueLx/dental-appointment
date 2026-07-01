-- Appointments table for dental booking system
CREATE TABLE IF NOT EXISTS appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_date DATE NOT NULL,
  start_time TIME NOT NULL,
  patient_name TEXT NOT NULL,
  patient_email TEXT NOT NULL,
  patient_phone TEXT NOT NULL,
  service TEXT NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT appointments_date_time_unique UNIQUE (appointment_date, start_time),
  CONSTRAINT appointments_valid_start_time CHECK (
    start_time IN (
      '08:00:00'::time,
      '09:00:00'::time,
      '10:00:00'::time,
      '11:00:00'::time,
      '12:00:00'::time,
      '14:00:00'::time,
      '15:00:00'::time,
      '16:00:00'::time
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments (appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments (status);

-- Table-level grants (required even for service_role with new Supabase API keys)
GRANT SELECT, INSERT, UPDATE ON appointments TO service_role;
GRANT SELECT ON appointments TO anon, authenticated;

-- Public view: no PII, for calendar availability display
CREATE OR REPLACE VIEW public_appointments AS
SELECT
  id,
  appointment_date,
  start_time,
  status
FROM appointments
WHERE status = 'confirmed';

GRANT SELECT ON public_appointments TO anon, authenticated, service_role;

ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- Anyone can read confirmed appointment slots (via view only for calendar)
CREATE POLICY "Public can view confirmed appointments via view"
  ON appointments
  FOR SELECT
  TO anon, authenticated
  USING (status = 'confirmed');

-- Inserts handled via service role (Server Actions / API routes)
-- No public insert/update/delete policies — use service role key server-side
