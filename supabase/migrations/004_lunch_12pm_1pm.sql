-- Lunch moved to 12–1 PM (remove 12:00 slot, add 13:00)
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_valid_start_time;

ALTER TABLE appointments ADD CONSTRAINT appointments_valid_start_time CHECK (
  start_time IN (
    '08:00:00'::time,
    '09:00:00'::time,
    '10:00:00'::time,
    '11:00:00'::time,
    '13:00:00'::time,
    '14:00:00'::time,
    '15:00:00'::time,
    '16:00:00'::time
  )
);
