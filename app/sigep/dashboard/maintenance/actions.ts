'use server';

import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/auth/session';
import { canViewMaintenance } from '@/lib/auth/permissions';
import { writeAudit } from '@/lib/audit/log';
import type { MaintenanceStatus } from '@/lib/supabase/types';

const isDemoMode = () => !process.env.NEXT_PUBLIC_SUPABASE_URL;

export async function updateMaintenanceStatusAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session || !canViewMaintenance(session.role)) return;

  const ticket_id = formData.get('ticket_id') as string;
  const status    = formData.get('status') as MaintenanceStatus;
  if (!ticket_id || !status) return;

  if (isDemoMode()) {
    const { MOCK_MAINTENANCE_TICKETS } = await import('@/lib/mock/data');
    const ticket = MOCK_MAINTENANCE_TICKETS.find((t) => t.id === ticket_id);
    if (ticket) {
      ticket.status = status;
      if (status === 'DONE') ticket.completed_at = new Date().toISOString();
    }
    await writeAudit({
      userId: session.id,
      action: 'MAINTENANCE_STATUS_UPDATE',
      tableName: 'maintenance_tickets',
      recordId: ticket_id,
      newData: { status },
    });
    revalidatePath('/sigep/dashboard/maintenance');
    return;
  }

  const { createAdminClient } = await import('@/lib/supabase/admin');
  const supabase = createAdminClient();
  if (!supabase) return;
  await supabase
    .from('maintenance_tickets')
    .update({ status, completed_at: status === 'DONE' ? new Date().toISOString() : null })
    .eq('id', ticket_id);
  revalidatePath('/sigep/dashboard/maintenance');
}

export async function createMaintenanceTicketAction(
  _: { error: string } | null,
  formData: FormData,
): Promise<{ error: string } | null> {
  const session = await getSession();
  if (!session || !canViewMaintenance(session.role)) return { error: 'Accès refusé' };

  const device_id        = formData.get('device_id') as string;
  const maintenance_type = formData.get('maintenance_type') as string;
  const description      = (formData.get('description') as string)?.trim();
  const priority         = parseInt(formData.get('priority') as string, 10) || 2;

  if (!device_id || !maintenance_type || !description) {
    return { error: 'Champs obligatoires manquants' };
  }

  if (isDemoMode()) {
    const { MOCK_MAINTENANCE_TICKETS, MOCK_DEVICES } = await import('@/lib/mock/data');
    const device = MOCK_DEVICES.find((d) => d.id === device_id);
    MOCK_MAINTENANCE_TICKETS.push({
      id: `mt-${Date.now()}`,
      device_id,
      device_imei: device?.imei ?? '000000000000000',
      maintenance_type: maintenance_type as never,
      status: 'PENDING',
      priority: priority as 1 | 2 | 3,
      description,
      assigned_to: session.id,
      scheduled_at: null,
      completed_at: null,
      notes: null,
      created_at: new Date().toISOString(),
    });
    revalidatePath('/sigep/dashboard/maintenance');
    return null;
  }

  return null;
}
