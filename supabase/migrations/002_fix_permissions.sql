-- Run this in Supabase SQL Editor if booking still fails with "permission denied"
-- Fixes grants for service_role (secret key) and public read access

GRANT SELECT, INSERT, UPDATE ON appointments TO service_role;
GRANT SELECT ON appointments TO anon, authenticated;

GRANT SELECT ON public_appointments TO anon, authenticated, service_role;
