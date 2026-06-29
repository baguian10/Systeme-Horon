// Device event log (#2) — records lifecycle events per bracelet for a
// defensible technical history (connections, commands, tamper, SIM changes…).

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supabase = any;

export type DeviceEventType =
  | 'ONLINE' | 'OFFLINE' | 'COMMAND' | 'RESTART'
  | 'TAMPER' | 'LOW_BATTERY' | 'SIM_CHANGE' | 'ASSIGN';

export async function logDeviceEvent(
  supabase: Supabase,
  e: { deviceId: string; caseId?: string | null; type: DeviceEventType; detail?: string | null; actorId?: string | null },
): Promise<void> {
  try {
    await supabase.from('device_events').insert({
      device_id: e.deviceId,
      case_id: e.caseId ?? null,
      event_type: e.type,
      detail: e.detail ?? null,
      actor_id: e.actorId ?? null,
    });
  } catch {
    // best-effort: never break the caller on logging failure
  }
}
