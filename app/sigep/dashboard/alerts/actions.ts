'use server';

import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/auth/session';
import { canResolveAlert, canResolveAlertType } from '@/lib/auth/permissions';

// Mirror the canonical IS_DEMO_MODE (lib/supabase/client.ts): demo unless BOTH
// the URL and anon key are present.
const isDemoMode = () =>
  !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function revalidate() {
  revalidatePath('/sigep/dashboard/alerts');
  revalidatePath('/sigep/dashboard');
}

// The alerts table has SELECT-only RLS policies (no FOR UPDATE for any role),
// so writes through the RLS-scoped server client silently affect 0 rows. Like
// every other mutation in the app, gate permissions in code (canResolveAlert +
// canResolveAlertType, checked by each caller) and write via the service role.
async function getClientFor(alertId: string) {
  const { createAdminClient } = await import('@/lib/supabase/admin');
  const supabase = createAdminClient();
  if (!supabase) return null;
  const { data } = await supabase.from('alerts').select('alert_type').eq('id', alertId).single();
  return { supabase, alertType: data?.alert_type as string | undefined };
}

// Acknowledge: "I have seen this" → ACKNOWLEDGED + who/when.
export async function acknowledgeAlertAction(formData: FormData) {
  const session = await getSession();
  if (!session || !canResolveAlert(session.role)) return;
  const alertId = formData.get('alertId') as string;
  if (!alertId) return;

  if (isDemoMode()) {
    const { MOCK_ALERTS } = await import('@/lib/mock/data');
    const a = MOCK_ALERTS.find((x) => x.id === alertId);
    if (a) { a.status = 'ACKNOWLEDGED'; a.acknowledged_by = session.id; a.acknowledged_at = new Date().toISOString(); }
    revalidate(); return;
  }
  const ctx = await getClientFor(alertId);
  if (!ctx) return;
  if (ctx.alertType && !canResolveAlertType(session.role, ctx.alertType)) return;
  await ctx.supabase.from('alerts')
    .update({ status: 'ACKNOWLEDGED', acknowledged_by: session.id, acknowledged_at: new Date().toISOString() })
    .eq('id', alertId).eq('is_resolved', false);
  const { writeAudit } = await import('@/lib/audit/log');
  await writeAudit({ userId: session.id, action: 'ACK_ALERT', tableName: 'alerts', recordId: alertId });
  revalidate();
}

// Assign to an operational user + move to IN_PROGRESS.
export async function assignAlertAction(formData: FormData) {
  const session = await getSession();
  if (!session || !canResolveAlert(session.role)) return;
  const alertId = formData.get('alertId') as string;
  const userId = (formData.get('userId') as string) || null;
  if (!alertId) return;

  if (isDemoMode()) {
    const { MOCK_ALERTS } = await import('@/lib/mock/data');
    const a = MOCK_ALERTS.find((x) => x.id === alertId);
    if (a) { a.assigned_to = userId; a.status = userId ? 'IN_PROGRESS' : a.status; }
    revalidate(); return;
  }
  const ctx = await getClientFor(alertId);
  if (!ctx) return;
  if (ctx.alertType && !canResolveAlertType(session.role, ctx.alertType)) return;
  await ctx.supabase.from('alerts')
    .update({ assigned_to: userId, status: userId ? 'IN_PROGRESS' : 'NEW' })
    .eq('id', alertId).eq('is_resolved', false);
  const { writeAudit } = await import('@/lib/audit/log');
  await writeAudit({ userId: session.id, action: 'ASSIGN_ALERT', tableName: 'alerts', recordId: alertId, newData: { assigned_to: userId } });
  revalidate();
}

// Resolve with a mandatory category + reason (defensible audit trail).
export async function resolveAlertAction(formData: FormData) {
  const session = await getSession();
  if (!session || !canResolveAlert(session.role)) return;

  const alertId = formData.get('alertId') as string;
  const category = ((formData.get('category') as string) || 'JUSTIFIED').toUpperCase();
  const reason = ((formData.get('reason') as string) || '').trim();
  if (!alertId || !reason) return; // reason is required
  const status = category === 'FALSE_ALARM' ? 'FALSE_ALARM' : 'RESOLVED';

  if (isDemoMode()) {
    const { MOCK_ALERTS } = await import('@/lib/mock/data');
    const a = MOCK_ALERTS.find((x) => x.id === alertId);
    if (a) {
      a.is_resolved = true; a.resolved_by = session.id; a.resolved_at = new Date().toISOString();
      a.status = status as never; a.resolution_category = category as never; a.resolution_reason = reason;
    }
    revalidate(); return;
  }
  const ctx = await getClientFor(alertId);
  if (!ctx) return;
  if (ctx.alertType && !canResolveAlertType(session.role, ctx.alertType)) return;
  await ctx.supabase.from('alerts')
    .update({
      is_resolved: true, resolved_by: session.id, resolved_at: new Date().toISOString(),
      status, resolution_category: category, resolution_reason: reason,
    })
    .eq('id', alertId).eq('is_resolved', false);
  const { writeAudit } = await import('@/lib/audit/log');
  await writeAudit({ userId: session.id, action: 'RESOLVE_ALERT', tableName: 'alerts', recordId: alertId, newData: { status, category } });
  revalidate();
}
