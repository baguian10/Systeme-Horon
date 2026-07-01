-- Home beacon is a passive BLE tag (no telemetry over the bracelet), so its
-- coin-cell life is tracked manually: record when the battery was last changed
-- and surface an age warning. Prevents a dead beacon silently faking "away".
ALTER TABLE beacons ADD COLUMN IF NOT EXISTS battery_changed_at DATE;
