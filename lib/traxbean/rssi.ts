// BLE RSSI ↔ distance (log-distance path-loss). TxPower = RSSI at 1 m.
// Shared by the beacon config UI and the manual tracker BLE scan.
const TX_POWER = -59;
const PATH_LOSS = 2.5;

export function metersToRssi(m: number): number {
  const d = Math.max(0.5, m);
  return Math.round(TX_POWER - 10 * PATH_LOSS * Math.log10(d));
}

export function rssiToMeters(rssi: number): number {
  const d = Math.pow(10, (TX_POWER - rssi) / (10 * PATH_LOSS));
  return Math.round(d * 10) / 10;
}
