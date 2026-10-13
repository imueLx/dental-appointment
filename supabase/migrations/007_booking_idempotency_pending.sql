-- Pending status for DB-first booking; idempotency + clinic location columns

ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_status_check;

ALTER TABLE appointments
  ADD CONSTRAINT appointments_status_check
  CHECK (status IN ('pending', 'confirmed', 'cancelled'));

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS clinic_location_id TEXT;

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS appointments_idempotency_key_unique
  ON appointments (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_status_pending
  ON appointments (status)
  WHERE status = 'pending';
