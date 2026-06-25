// System settings — single-row config read via the admin client.

export interface SystemSettings {
  battery_alert_pct: number;
  signal_lost_min: number;
  geofence_buffer_m: number;
  position_retention_days: number;
  audit_retention_days: number;
  session_timeout_min: number;
  escalate_minutes: number;
  sms_enabled: boolean;
  sms_provider: string | null;
  timezone: string;
}

export const DEFAULT_SETTINGS: SystemSettings = {
  battery_alert_pct: 20,
  signal_lost_min: 15,
  geofence_buffer_m: 25,
  position_retention_days: 90,
  audit_retention_days: 365,
  session_timeout_min: 30,
  escalate_minutes: 30,
  sms_enabled: false,
  sms_provider: null,
  timezone: 'Africa/Ouagadougou',
};

export async function getSettings(): Promise<SystemSettings> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return DEFAULT_SETTINGS;
  try {
    const { createAdminClient } = await import('@/lib/supabase/admin');
    const sb = createAdminClient();
    if (!sb) return DEFAULT_SETTINGS;
    const { data } = await sb.from('system_settings').select('*').eq('id', 1).maybeSingle();
    return { ...DEFAULT_SETTINGS, ...(data ?? {}) } as SystemSettings;
  } catch {
    return DEFAULT_SETTINGS;
  }
}
