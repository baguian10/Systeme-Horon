-- Beacon home-alarm mode: how the "left home" alarm is decided.
--   GPS  = distance from a recorded home GPS point (needs home_lat/lng)
--   BLE  = pure BLE proximity — the bracelet must keep seeing the beacon above
--          the RSSI threshold; no geofence / home GPS required
--   BOTH = GPS distance, suppressed while the beacon is still in BLE range
-- Default BOTH preserves the existing behaviour (GPS alarm + BLE suppression).
DO $$ BEGIN CREATE TYPE beacon_alarm_mode AS ENUM ('GPS','BLE','BOTH'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE beacons ADD COLUMN IF NOT EXISTS alarm_mode beacon_alarm_mode NOT NULL DEFAULT 'BOTH';
