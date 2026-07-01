-- Track when the tracker stopped uploading BLE scans while a beacon alarm is
-- active. If the BLE scan goes silent for too long, the home surveillance is
-- effectively blind — we must alert instead of staying silently "unknown".
ALTER TABLE beacons
  ADD COLUMN IF NOT EXISTS ble_scan_lost_at TIMESTAMPTZ;
