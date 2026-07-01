-- Distinct alarm type for the BLE home-beacon exit, so it doesn't dedupe against
-- the GPS geofence exit (both used GEOFENCE_EXIT and collided). Must be its own
-- migration: a new enum value can't be used in the same transaction it's added.
ALTER TYPE alert_type ADD VALUE IF NOT EXISTS 'BLE_EXIT';
