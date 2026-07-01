-- Live BLE connection status of a beacon: whether the linked bracelet is
-- currently detecting it, at what signal, and when last checked. Lets an
-- operator confirm the beacon is really seen by the tracker.
ALTER TABLE beacons
  ADD COLUMN IF NOT EXISTS ble_present    BOOLEAN,
  ADD COLUMN IF NOT EXISTS ble_rssi       INTEGER,
  ADD COLUMN IF NOT EXISTS ble_checked_at TIMESTAMPTZ;
