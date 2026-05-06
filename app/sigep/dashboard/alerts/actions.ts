'use server';

import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/auth/session';
import { canResolveAlert } from '@/lib/auth/permissions';
import { IS_DEMO_MODE } from '@/lib/mock/helpers';

export async function resolveAlertAction(formData: FormData) {
  const session = await getSession();
  if (!session || !canResolveAlert(session.role)) return;

  const alertId = formData.get('alertId') as string;
  if (!alertId) return;

  if (IS_DEMO_MODE) {
    // Demo mode — no-op, just revalidate to show optimistic feel
    revalidatePath('/sigep/dashboard/alerts');
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
