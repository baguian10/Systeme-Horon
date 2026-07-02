-- Persist whether the "high BLE availability" preset is active on a device, so
-- the toggle stays checked after a page refresh instead of resetting.
ALTER TABLE devices ADD COLUMN IF NOT EXISTS ble_high_avail BOOLEAN DEFAULT false;
