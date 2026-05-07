'use server';

import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/auth/session';
import { canManageTigSites } from '@/lib/auth/permissions';
import { writeAudit } from '@/lib/audit/log';

const isDemoMode = () => !process.env.NEXT_PUBLIC_SUPABASE_URL;

export async function createTigSiteAction(
  _: { error: string } | null,
  formData: FormData,
): Promise<{ error: string } | null> {
  const session = await getSession();
  if (!session || !canManageTigSites(session.role)) return { error: 'Accès refusé' };

  const name           = (formData.get('name') as string)?.trim();
  const category       = formData.get('category') as string;
  const address        = (formData.get('address') as string)?.trim();
  const arrondissement = (formData.get('arrondissement') as string)?.trim();
  const contact_name   = (formData.get('contact_name') as string)?.trim();
  const contact_phone  = (formData.get('contact_phone') as string)?.trim();
  const capacity       = parseInt(formData.get('capacity') as string, 10) || 1;
  const hours          = (formData.get('hours') as string)?.trim();
  const latitude       = parseFloat(formData.get('latitude') as string);
  const longitude      = parseFloat(formData.get('longitude') as string);

  if (!name || !category || !address || !arrondissement || !contact_name) {
    return { error: 'Veuillez remplir tous les champs obligatoires' };
  }

  if (isDemoMode()) {
    const { MOCK_TIG_SITES } = await import('@/lib/mock/data');
    MOCK_TIG_SITES.push({
      id: `ts-${Date.now()}`,
      name, category: category as never, address, arrondissement,
      contact_name, contact_phone: contact_phone || '—',
      capacity, current_count: 0,
      hours: hours || 'Lun–Ven 08h00–17h00',
      is_active: true,
      latitude: isNaN(latitude) ? 12.3647 : latitude,
      longitude: isNaN(longitude) ? -1.5332 : longitude,
      created_at: new Date().toISOString(),
    });
    await writeAudit({ userId: session.id, action: 'CREATE_TIG_SITE', tableName: 'tig_sites', recordId: `ts-${Date.now()}`, newData: { name } });
    revalidatePath('/sigep/dashboard/tig-sites');
    return null;
  }

  const { createAdminClient } = await import('@/lib/supabase/admin');
  const supabase = createAdminClient();
  if (!supabase) return { error: 'Base de données indisponible' };

  const { error } = await supabase.from('tig_sites').insert({
    name, category, address, arrondissement, contact_name, contact_phone,
    capacity, hours, is_active: true,
    latitude: isNaN(latitude) ? null : latitude,
    longitude: isNaN(longitude) ? null : longitude,
  });

  if (error) return { error: 'Erreur lors de la création du site' };
  revalidatePath('/sigep/dashboard/tig-sites');
  return null;
}

export async function toggleTigSiteAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session || !canManageTigSites(session.role)) return;

  const site_id   = formData.get('site_id') as string;
  const is_active = formData.get('is_active') === 'true';
  if (!site_id) return;

  if (isDemoMode()) {
    const { MOCK_TIG_SITES } = await import('@/lib/mock/data');
    const s = MOCK_TIG_SITES.find((s) => s.id === site_id);
    if (s) s.is_active = !is_active;
    revalidatePath('/sigep/dashboard/tig-sites');
    return;
  }

  const { createAdminClient } = await import('@/lib/supabase/admin');
  const supabase = createAdminClient();
  if (!supabase) return;
  await supabase.from('tig_sites').update({ is_active: !is_active }).eq('id', site_id);
  revalidatePath('/sigep/dashboard/tig-sites');
}
