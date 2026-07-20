-- Deduplicate Cal.com webhook + app create races
CREATE UNIQUE INDEX IF NOT EXISTS appointments_cal_booking_uid_unique
  ON appointments (cal_booking_uid)
  WHERE cal_booking_uid IS NOT NULL;
