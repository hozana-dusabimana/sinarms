-- Per-organization toggle for the visitor distance check (geofence).
-- When enabled (default), self check-in is gated to within CHECKIN_RADIUS_M of
-- the entrance and the visitor app auto-checks-out on exit. When disabled, a
-- visitor can check in from anywhere and the receptionist closes visits manually.
ALTER TABLE organizations
  ADD COLUMN distance_check_enabled TINYINT(1) NOT NULL DEFAULT 1;
