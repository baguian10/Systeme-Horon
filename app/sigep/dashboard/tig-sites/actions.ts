'use server';

import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/auth/session';
import { canManageTigSites, canSetMeasureConditions } from '@/lib/auth/permissions';
import { writeAudit } from '@/lib/audit/log';
import type { TigSiteCategory } from '@/lib/supabase/types';

const isDemoMode = () =>
  !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const VALID_CATEGORIES: TigSiteCategory[] = [
  'MAIRIE', 'HOPITAL', 'ECOLE', 'ONG', 'ESPACE_VERT', 'AUTRE',
];

async function getSupabase() {
  const { createAdminClient } = await import('@/lib/supabase/admin');
  return createAdminClient();
}

// ── Create ───────────────────────────────────────────────────────────────────

export async function createTigSiteAction(
  _: { error: string } | null,
  formData: FormData,
): Promise<{ error: string } | null> {
  const session = await getSession();
  if (!session || !canManageTigSites(session.role)) return { error: 'Accès refusé' };

  const name           = (formData.get('name') as string)?.trim();
  const category       = formData.get('category') as TigSiteCategory;
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
  if (!VALID_CATEGORIES.includes(category)) {
    return { error: 'Catégorie invalide' };
  }

  if (isDemoMode()) {
    const { MOCK_TIG_SITES } = await import('@/lib/mock/data');
    MOCK_TIG_SITES.push({
      id: `ts-${Date.now()}`,
      name, category, address, arrondissement,
      contact_name, contact_phone: contact_phone || '—',
      capacity, current_count: 0,
      hours: hours || 'Lun–Ven 08h00–17h00',
      is_active: true,
      latitude: isNaN(latitude) ? 12.3647 : latitude,
      longitude: isNaN(longitude) ? -1.5332 : longitude,
      created_at: new Date().toISOString(),
    });
    revalidatePath('/sigep/dashboard/tig-sites');
    return null;
  }

  const supabase = await getSupabase();
  if (!supabase) return { error: 'Base de données indisponible' };

  const { data, error } = await supabase.from('tig_sites').insert({
    name, category, address, arrondissement, contact_name, contact_phone,
    capacity, hours, is_active: true,
    latitude: isNaN(latitude) ? null : latitude,
    longitude: isNaN(longitude) ? null : longitude,
  }).select('id').single();

  if (error) return { error: 'Erreur lors de la création du site' };
  await writeAudit({ userId: session.id, action: 'CREATE_TIG_SITE', tableName: 'tig_sites', recordId: data?.id, newData: { name } });
  revalidatePath('/sigep/dashboard/tig-sites');
  return null;
}

// ── Update ───────────────────────────────────────────────────────────────────

export async function updateTigSiteAction(formData: FormData): Promise<{ error: string } | void> {
  const session = await getSession();
  if (!session || !canManageTigSites(session.role)) return { error: 'Accès refusé' };

  const id             = formData.get('id') as string;
  const name           = (formData.get('name') as string)?.trim();
  const category       = formData.get('category') as TigSiteCategory;
  const address        = (formData.get('address') as string)?.trim();
  const arrondissement = (formData.get('arrondissement') as string)?.trim();
  const contact_name   = (formData.get('contact_name') as string)?.trim();
  const contact_phone  = (formData.get('contact_phone') as string)?.trim();
  const capacity       = parseInt(formData.get('capacity') as string, 10) || 1;
  const hours          = (formData.get('hours') as string)?.trim();

  if (!id || !name || !category || !address || !arrondissement || !contact_name) {
    return { error: 'Champs obligatoires manquants' };
  }
  if (!VALID_CATEGORIES.includes(category)) return { error: 'Catégorie invalide' };

  if (isDemoMode()) {
    const { MOCK_TIG_SITES } = await import('@/lib/mock/data');
    const s = MOCK_TIG_SITES.find((x) => x.id === id);
    if (s) Object.assign(s, { name, category, address, arrondissement, contact_name, contact_phone, capacity, hours });
    revalidatePath('/sigep/dashboard/tig-sites');
    return;
  }

  const supabase = await getSupabase();
  if (!supabase) return { error: 'Base de données indisponible' };
  const { error } = await supabase.from('tig_sites')
    .update({ name, category, address, arrondissement, contact_name, contact_phone, capacity, hours })
    .eq('id', id);
  if (error) return { error: 'Erreur lors de la mise à jour' };
  await writeAudit({ userId: session.id, action: 'UPDATE_TIG_SITE', tableName: 'tig_sites', recordId: id, newData: { name } });
  revalidatePath('/sigep/dashboard/tig-sites');
}

// ── Delete ───────────────────────────────────────────────────────────────────

export async function deleteTigSiteAction(formData: FormData): Promise<{ error: string } | void> {
  const session = await getSession();
  if (!session || !canManageTigSites(session.role)) return { error: 'Accès refusé' };

  const id = formData.get('id') as string;
  if (!id) return { error: 'ID manquant' };

  if (isDemoMode()) {
    const { MOCK_TIG_SITES } = await import('@/lib/mock/data');
    const idx = MOCK_TIG_SITES.findIndex((s) => s.id === id);
    if (idx !== -1) MOCK_TIG_SITES.splice(idx, 1);
    revalidatePath('/sigep/dashboard/tig-sites');
    return;
  }

  const supabase = await getSupabase();
  if (!supabase) return { error: 'Base de données indisponible' };

  const { count } = await supabase
    .from('cases')
    .select('id', { count: 'exact', head: true })
    .eq('tig_site_id', id)
    .in('status', ['ACTIVE', 'VIOLATION', 'SUSPENDED']);
  if (count && count > 0) {
    return { error: `${count} dossier(s) TIG actif(s) affecté(s) à ce site. Réaffectez-les avant suppression.` };
  }

  const { error } = await supabase.from('tig_sites').delete().eq('id', id);
  if (error) return { error: 'Erreur lors de la suppression' };
  await writeAudit({ userId: session.id, action: 'DELETE_TIG_SITE', tableName: 'tig_sites', recordId: id });
  revalidatePath('/sigep/dashboard/tig-sites');
}

// ── Toggle ───────────────────────────────────────────────────────────────────

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

  const supabase = await getSupabase();
  if (!supabase) return;
  await supabase.from('tig_sites').update({ is_active: !is_active }).eq('id', site_id);
  await writeAudit({
    userId: session.id,
    action: !is_active ? 'ACTIVATE_TIG_SITE' : 'DEACTIVATE_TIG_SITE',
    tableName: 'tig_sites',
    recordId: site_id,
  });
  revalidatePath('/sigep/dashboard/tig-sites');
}

// ── Case ↔ site assignment ───────────────────────────────────────────────────

export async function assignCaseTigSiteAction(formData: FormData): Promise<{ error: string } | void> {
  const session = await getSession();
  if (!session || !canSetMeasureConditions(session.role)) return { error: 'Accès refusé' };

  const case_id    = formData.get('case_id') as string;
  const tig_site_id = (formData.get('tig_site_id') as string) || null;
  if (!case_id) return { error: 'Dossier manquant' };

  if (isDemoMode()) {
    const { MOCK_CASES } = await import('@/lib/mock/data');
    const c = MOCK_CASES.find((x) => x.id === case_id);
    if (c) c.tig_site_id = tig_site_id ?? undefined;
    revalidatePath(`/sigep/dashboard/cases/${case_id}`);
    return;
  }

  const supabase = await getSupabase();
  if (!supabase) return { error: 'Base de données indisponible' };
  const { error } = await supabase.from('cases').update({ tig_site_id }).eq('id', case_id);
  if (error) return { error: 'Erreur lors de l\'affectation' };
  await writeAudit({ userId: session.id, action: 'ASSIGN_TIG_SITE', tableName: 'cases', recordId: case_id, newData: { tig_site_id } });
  revalidatePath(`/sigep/dashboard/cases/${case_id}`);
}

// ── Hours ordered ────────────────────────────────────────────────────────────

export async function updateTigHoursOrderedAction(formData: FormData): Promise<{ error: string } | void> {
  const session = await getSession();
  if (!session || !canSetMeasureConditions(session.role)) return { error: 'Accès refusé' };

  const case_id          = formData.get('case_id') as string;
  const tig_hours_ordered = parseInt(formData.get('tig_hours_ordered') as string, 10);
  if (!case_id || isNaN(tig_hours_ordered) || tig_hours_ordered < 1) {
    return { error: 'Nombre d\'heures invalide' };
  }

  if (isDemoMode()) {
    const { MOCK_CASES } = await import('@/lib/mock/data');
    const c = MOCK_CASES.find((x) => x.id === case_id);
    if (c) c.tig_hours_ordered = tig_hours_ordered;
    revalidatePath(`/sigep/dashboard/cases/${case_id}`);
    return;
  }

  const supabase = await getSupabase();
  if (!supabase) return { error: 'Base de données indisponible' };
  const { error } = await supabase.from('cases').update({ tig_hours_ordered }).eq('id', case_id);
  if (error) return { error: 'Erreur lors de la mise à jour' };
  await writeAudit({ userId: session.id, action: 'UPDATE_TIG_HOURS_ORDERED', tableName: 'cases', recordId: case_id, newData: { tig_hours_ordered } });
  revalidatePath(`/sigep/dashboard/cases/${case_id}`);
}

// ── Attendance log ────────────────────────────────────────────────────────────

export async function addTigAttendanceAction(formData: FormData): Promise<{ error: string } | void> {
  const session = await getSession();
  if (!session || !canSetMeasureConditions(session.role)) return { error: 'Accès refusé' };

  const case_id        = formData.get('case_id') as string;
  const tig_site_id    = formData.get('tig_site_id') as string;
  const session_date   = formData.get('session_date') as string;
  const hours_worked   = parseFloat(formData.get('hours_worked') as string);
  const supervisor_notes = (formData.get('supervisor_notes') as string)?.trim() || null;

  if (!case_id || !tig_site_id || !session_date || isNaN(hours_worked) || hours_worked <= 0) {
    return { error: 'Champs obligatoires manquants ou invalides' };
  }
  if (hours_worked > 24) return { error: 'Maximum 24 heures par session' };

  if (isDemoMode()) {
    const { MOCK_TIG_ATTENDANCE, MOCK_CASES } = await import('@/lib/mock/data');
    const newRecord = {
      id: `ta-${Date.now()}`,
      case_id, tig_site_id, session_date,
      hours_worked,
      signed_by_id: null,
      supervisor_notes,
      created_by: session.id,
      created_at: new Date().toISOString(),
    };
    MOCK_TIG_ATTENDANCE.push(newRecord);
    const c = MOCK_CASES.find((x) => x.id === case_id);
    if (c) c.tig_hours_completed = (c.tig_hours_completed ?? 0) + hours_worked;
    revalidatePath(`/sigep/dashboard/cases/${case_id}`);
    return;
  }

  const supabase = await getSupabase();
  if (!supabase) return { error: 'Base de données indisponible' };

  const { data, error } = await supabase.from('tig_attendance').insert({
    case_id, tig_site_id, session_date, hours_worked, supervisor_notes,
    created_by: session.id,
  }).select('id').single();

  if (error) return { error: 'Erreur lors de l\'enregistrement du pointage' };

  // Recompute total from all attendance records (source of truth)
  const { data: allSessions } = await supabase
    .from('tig_attendance')
    .select('hours_worked')
    .eq('case_id', case_id);
  const total = (allSessions ?? []).reduce((acc: number, r: { hours_worked: number }) => acc + r.hours_worked, 0);
  await supabase.from('cases').update({ tig_hours_completed: Math.round(total) }).eq('id', case_id);

  await writeAudit({ userId: session.id, action: 'ADD_TIG_ATTENDANCE', tableName: 'tig_attendance', recordId: data?.id, newData: { case_id, session_date, hours_worked } });
  revalidatePath(`/sigep/dashboard/cases/${case_id}`);
}
