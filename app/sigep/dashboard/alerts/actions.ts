'use server';

import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/auth/session';
import { canResolveAlert } from '@/lib/auth/permissions';

const isDemoMode = () => !process.env.NEXT_PUBLIC_SUPABASE_URL;

export async function resolveAlertAction(formData: FormData) {
  const session = await getSession();
  if (!session || !canResolveAlert(session.role)) return;

  const alertId = formData.get('alertId') as string;
  if (!alertId) return;

  if (isDemoMode()) {
    const { MOCK_ALERTS } = await import('@/lib/mock/data');
    const alert = MOCK_ALERTS.find((a) => a.id === alertId);
    if (alert) {
      alert.is_resolved = true;
      alert.resolved_by = session.id;
      alert.resolved_at = new Date().toISOString();
    }
    revalidatePath('/sigep/dashboard/alerts');
    revalidatePath('/sigep/dashboard');
    return;
  }

  const { createClient } = await import('@/lib/supabase/server');
  const supabase = await createClient();
  if (!supabase) return;

  await supabase
    .from('alerts')
    .update({ is_resolved: true, resolved_by: session.id, resolved_at: new Date().toISOString() })
    .eq('id', alertId);

  revalidatePath('/sigep/dashboard/alerts');
  revalidatePath('/sigep/dashboard');
}
