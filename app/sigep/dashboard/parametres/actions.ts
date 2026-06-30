'use server';

import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/auth/session';
import { allow } from '@/lib/auth/permissions';

const num = (fd: FormData, k: string, def: number, min: number, max: number) => {
  const v = Math.round(Number(fd.get(k)) || def);
  return Math.max(min, Math.min(max, v));
};

export async function saveSettingsAction(_: { ok?: boolean; error?: string } | null, fd: FormData): Promise<{ ok?: boolean; error?: string }> {
  const session = await getSession();
  // System parameters: SUPER_ADMIN, or an ADMIN with a hardware/audit-level grant.
  if (!session || (session.role !== 'SUPER_ADMIN' && !allow(session, false, 'audit'))) {
    return { error: 'Accès refusé' };
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return { ok: true };

  const update = {
    battery_alert_pct: num(fd, 'battery_alert_pct', 20, 1, 100),
    signal_lost_min: num(fd, 'signal_lost_min', 15, 1, 1440),
    geofence_buffer_m: num(fd, 'geofence_buffer_m', 25, 0, 1000),
    position_retention_days: num(fd, 'position_retention_days', 90, 7, 3650),
    audit_retention_days: num(fd, 'audit_retention_days', 365, 30, 3650),
    session_timeout_min: num(fd, 'session_timeout_min', 30, 5, 480),
    escalate_minutes: num(fd, 'escalate_minutes', 30, 1, 1440),
    sms_enabled: fd.get('sms_enabled') === 'on',
    sms_provider: (fd.get('sms_provider') as string)?.trim() || null,
    sms_endpoint: (fd.get('sms_endpoint') as string)?.trim() || null,
    sms_api_key: (fd.get('sms_api_key') as string)?.trim() || null,
    sms_sender: (fd.get('sms_sender') as string)?.trim() || null,
    timezone: (fd.get('timezone') as string)?.trim() || 'Africa/Ouagadougou',
    updated_at: new Date().toISOString(),
  };

  const { createAdminClient } = await import('@/lib/supabase/admin');
  const sb = createAdminClient();
  if (!sb) return { error: 'DB indisponible' };
  const { error } = await sb.from('system_settings').update(update).eq('id', 1);
  if (error) return { error: error.message };

  const { writeAudit } = await import('@/lib/audit/log');
  await writeAudit({ userId: session.id, action: 'UPDATE_SETTINGS', tableName: 'system_settings', newData: update });
  revalidatePath('/sigep/dashboard/parametres');
  return { ok: true };
}
