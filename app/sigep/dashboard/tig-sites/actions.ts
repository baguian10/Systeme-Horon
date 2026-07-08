'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/auth/session';
import { allow, canManageTigSites, canSetMeasureConditions, canLogTigAttendance } from '@/lib/auth/permissions';
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

type Session = NonNullable<Awaited<ReturnType<typeof getSession>>>;
function canManage(session: Session) {
  return allow(session, canManageTigSites(session.role), 'tig');
}

function parseCapacity(raw: FormDataEntryValue | null): number | null {
  const n = parseInt(raw as string, 10);
  // Server-side bounds: 1–500. Invalid → null so the action can REFUSE instead
  // of silently coercing (600 → capacity 1 surprised operators).
  return Number.isFinite(n) && n >= 1 && n <= 500 ? n : null;
}

// Coordinates must be plausible or absent — a typo like lat=999 must not
// enter the geolocation pipeline.
function parseCoord(raw: FormDataEntryValue | null, min: number, max: number): number | null | 'invalid' {
  const s = (raw as string)?.trim();
  if (!s) return null;
  const n = parseFloat(s);
  if (!Number.isFinite(n)) return 'invalid';
  return n >= min && n <= max ? n : 'invalid';
}

function fieldLengthError(fields: Record<string, [string | null | undefined, number]>): string | null {
  for (const [label, [v, max]] of Object.entries(fields)) {
    if (v && v.length > max) return `${label} trop long (max ${max} caractères)`;
  }
  return null;
}

// ── Create ───────────────────────────────────────────────────────────────────

export async function createTigSiteAction(
  _: { error: string } | null,
  formData: FormData,
): Promise<{ error: string } | null> {
  const session = await getSession();
  if (!session || !canManage(session)) return { error: 'Accès refusé' };

  const name           = (formData.get('name') as string)?.trim();
  const category       = formData.get('category') as TigSiteCategory;
  const address        = (formData.get('address') as string)?.trim();
  const arrondissement = (formData.get('arrondissement') as string)?.trim();
  const contact_name   = (formData.get('contact_name') as string)?.trim();
  const contact_phone  = (formData.get('contact_phone') as string)?.trim();
  const capacity       = parseCapacity(formData.get('capacity'));
  const hours          = (formData.get('hours') as string)?.trim();
  const latitude       = parseCoord(formData.get('latitude'), -90, 90);
  const longitude      = parseCoord(formData.get('longitude'), -180, 180);

  if (!name || !category || !address || !arrondissement || !contact_name) {
    return { error: 'Veuillez remplir tous les champs obligatoires' };
  }
  if (!VALID_CATEGORIES.includes(category)) return { error: 'Catégorie invalide' };
  if (capacity == null) return { error: 'Capacité invalide (entre 1 et 500)' };
  if (latitude === 'invalid' || longitude === 'invalid') return { error: 'Coordonnées GPS invalides' };
  const lenErr = fieldLengthError({
    'Nom': [name, 150], 'Adresse': [address, 300], 'Contact': [contact_name, 100],
    'Téléphone': [contact_phone, 30], 'Horaires': [hours, 100],
  });
  if (lenErr) return { error: lenErr };

  if (isDemoMode()) {
    const { MOCK_TIG_SITES } = await import('@/lib/mock/data');
    MOCK_TIG_SITES.push({
      id: `ts-${crypto.randomUUID()}`,
      name, category, address, arrondissement,
      contact_name, contact_phone: contact_phone || '—',
      capacity, current_count: 0,
      hours: hours || 'Lun–Ven 08h00–17h00',
      is_active: true,
      latitude, longitude,
      created_at: new Date().toISOString(),
    });
    revalidatePath('/sigep/dashboard/tig-sites');
    redirect('/sigep/dashboard/tig-sites');
  }

  const supabase = await getSupabase();
  if (!supabase) return { error: 'Base de données indisponible' };

  const { data, error } = await supabase.from('tig_sites').insert({
    name, category, address, arrondissement, contact_name, contact_phone,
    capacity, hours, is_active: true,
    latitude, longitude,
  }).select('id').single();

  if (error) return { error: 'Erreur lors de la création du site' };
  await writeAudit({ userId: session.id, action: 'CREATE_TIG_SITE', tableName: 'tig_sites', recordId: data?.id, newData: { name } });
  revalidatePath('/sigep/dashboard/tig-sites');
  redirect('/sigep/dashboard/tig-sites');
}

// ── Update ───────────────────────────────────────────────────────────────────

export async function updateTigSiteAction(formData: FormData): Promise<{ error: string } | void> {
  const session = await getSession();
  if (!session || !canManage(session)) return { error: 'Accès refusé' };

  const id             = formData.get('id') as string;
  const name           = (formData.get('name') as string)?.trim();
  const category       = formData.get('category') as TigSiteCategory;
  const address        = (formData.get('address') as string)?.trim();
  const arrondissement = (formData.get('arrondissement') as string)?.trim();
  const contact_name   = (formData.get('contact_name') as string)?.trim();
  const contact_phone  = (formData.get('contact_phone') as string)?.trim();
  const capacity       = parseCapacity(formData.get('capacity'));
  const hours          = (formData.get('hours') as string)?.trim();
  const latitude       = parseCoord(formData.get('latitude'), -90, 90);
  const longitude      = parseCoord(formData.get('longitude'), -180, 180);

  if (!id || !name || !category || !address || !arrondissement || !contact_name) {
    return { error: 'Champs obligatoires manquants' };
  }
  if (!VALID_CATEGORIES.includes(category)) return { error: 'Catégorie invalide' };
  if (capacity == null) return { error: 'Capacité invalide (entre 1 et 500)' };
  if (latitude === 'invalid' || longitude === 'invalid') return { error: 'Coordonnées GPS invalides' };
  const lenErr = fieldLengthError({
    'Nom': [name, 150], 'Adresse': [address, 300], 'Contact': [contact_name, 100],
    'Téléphone': [contact_phone, 30], 'Horaires': [hours, 100],
  });
  if (lenErr) return { error: lenErr };

  if (isDemoMode()) {
    const { MOCK_TIG_SITES, MOCK_CASES } = await import('@/lib/mock/data');
    const occ = MOCK_CASES.filter((c) => c.tig_site_id === id && ['ACTIVE', 'VIOLATION'].includes(c.status)).length;
    if (capacity < occ) return { error: `Capacité insuffisante : ${occ} dossier(s) actif(s) sur ce site` };
    const s = MOCK_TIG_SITES.find((x) => x.id === id);
    if (s) Object.assign(s, { name, category, address, arrondissement, contact_name, contact_phone, capacity, hours, latitude, longitude });
    revalidatePath('/sigep/dashboard/tig-sites');
    revalidatePath(`/sigep/dashboard/tig-sites/${id}`);
    return;
  }

  const supabase = await getSupabase();
  if (!supabase) return { error: 'Base de données indisponible' };

  const { count: occ } = await supabase
    .from('cases').select('id', { count: 'exact', head: true })
    .eq('tig_site_id', id).in('status', ['ACTIVE', 'VIOLATION']);
  if (capacity < (occ ?? 0)) {
    return { error: `Capacité insuffisante : ${occ} dossier(s) actif(s) sur ce site` };
  }

  const { error } = await supabase.from('tig_sites')
    .update({ name, category, address, arrondissement, contact_name, contact_phone, capacity, hours, latitude, longitude })
    .eq('id', id);
  if (error) return { error: 'Erreur lors de la mise à jour' };
  await writeAudit({ userId: session.id, action: 'UPDATE_TIG_SITE', tableName: 'tig_sites', recordId: id, newData: { name } });
  revalidatePath('/sigep/dashboard/tig-sites');
  revalidatePath(`/sigep/dashboard/tig-sites/${id}`);
}

// ── Delete ───────────────────────────────────────────────────────────────────

export async function deleteTigSiteAction(formData: FormData): Promise<{ error: string } | void> {
  const session = await getSession();
  if (!session || !canManage(session)) return { error: 'Accès refusé' };

  const id = formData.get('id') as string;
  if (!id) return { error: 'ID manquant' };

  if (isDemoMode()) {
    const { MOCK_TIG_SITES, MOCK_CASES, MOCK_TIG_ATTENDANCE } = await import('@/lib/mock/data');
    const occ = MOCK_CASES.filter((c) =>
      c.tig_site_id === id && ['ACTIVE', 'VIOLATION', 'SUSPENDED'].includes(c.status)
    ).length;
    if (occ > 0) return { error: `${occ} dossier(s) TIG actif(s) affecté(s) à ce site. Réaffectez-les avant suppression.` };
    const attCount = MOCK_TIG_ATTENDANCE.filter((a) => a.tig_site_id === id).length;
    if (attCount > 0) return { error: `${attCount} pointage(s) historique(s) référencent ce site.` };
    const idx = MOCK_TIG_SITES.findIndex((s) => s.id === id);
    if (idx !== -1) MOCK_TIG_SITES.splice(idx, 1);
    // Clean dangling tig_site_id on terminated/archived cases
    for (const c of MOCK_CASES) { if (c.tig_site_id === id) c.tig_site_id = undefined; }
    revalidatePath('/sigep/dashboard/tig-sites');
    return;
  }

  const supabase = await getSupabase();
  if (!supabase) return { error: 'Base de données indisponible' };

  const { count: caseCount } = await supabase.from('cases')
    .select('id', { count: 'exact', head: true })
    .eq('tig_site_id', id).in('status', ['ACTIVE', 'VIOLATION', 'SUSPENDED']);
  if (caseCount && caseCount > 0) {
    return { error: `${caseCount} dossier(s) TIG actif(s) affecté(s) à ce site. Réaffectez-les avant suppression.` };
  }

  const { count: attCount } = await supabase.from('tig_attendance')
    .select('id', { count: 'exact', head: true }).eq('tig_site_id', id);
  if (attCount && attCount > 0) {
    return { error: `${attCount} pointage(s) historique(s) référencent ce site.` };
  }

  const { error } = await supabase.from('tig_sites').delete().eq('id', id);
  if (error) return { error: 'Erreur lors de la suppression' };
  await writeAudit({ userId: session.id, action: 'DELETE_TIG_SITE', tableName: 'tig_sites', recordId: id });
  revalidatePath('/sigep/dashboard/tig-sites');
}

// ── Toggle (returns error if active occupants when deactivating) ──────────────

export async function toggleTigSiteAction(formData: FormData): Promise<{ error: string } | void> {
  const session = await getSession();
  if (!session || !canManage(session)) return { error: 'Accès refusé' };

  const site_id   = formData.get('site_id') as string;
  const is_active = formData.get('is_active') === 'true';
  if (!site_id) return { error: 'ID manquant' };

  if (isDemoMode()) {
    const { MOCK_TIG_SITES, MOCK_CASES } = await import('@/lib/mock/data');
    if (is_active) {
      const occ = MOCK_CASES.filter((c) =>
        c.tig_site_id === site_id && ['ACTIVE', 'VIOLATION', 'SUSPENDED'].includes(c.status)
      ).length;
      if (occ > 0) return { error: `${occ} bénéficiaire(s) actif(s) sur ce site. Réaffectez-les avant désactivation.` };
    }
    const s = MOCK_TIG_SITES.find((s) => s.id === site_id);
    if (s) s.is_active = !is_active;
    revalidatePath('/sigep/dashboard/tig-sites');
    revalidatePath(`/sigep/dashboard/tig-sites/${site_id}`);
    return;
  }

  const supabase = await getSupabase();
  if (!supabase) return { error: 'Base de données indisponible' };

  if (is_active) {
    const { count } = await supabase.from('cases')
      .select('id', { count: 'exact', head: true })
      .eq('tig_site_id', site_id).in('status', ['ACTIVE', 'VIOLATION', 'SUSPENDED']);
    if (count && count > 0) {
      return { error: `${count} bénéficiaire(s) actif(s) sur ce site. Réaffectez-les avant désactivation.` };
    }
  }

  await supabase.from('tig_sites').update({ is_active: !is_active }).eq('id', site_id);
  await writeAudit({
    userId: session.id,
    action: !is_active ? 'ACTIVATE_TIG_SITE' : 'DEACTIVATE_TIG_SITE',
    tableName: 'tig_sites', recordId: site_id,
  });
  revalidatePath('/sigep/dashboard/tig-sites');
  revalidatePath(`/sigep/dashboard/tig-sites/${site_id}`);
}

// ── Case ↔ site assignment ───────────────────────────────────────────────────

export async function assignCaseTigSiteAction(formData: FormData): Promise<{ error: string } | void> {
  const session = await getSession();
  if (!session || !canSetMeasureConditions(session.role)) return { error: 'Accès refusé' };

  const case_id     = formData.get('case_id') as string;
  const tig_site_id = (formData.get('tig_site_id') as string) || null;
  if (!case_id) return { error: 'Dossier manquant' };

  if (isDemoMode()) {
    const { MOCK_CASES, MOCK_TIG_SITES } = await import('@/lib/mock/data');
    const c = MOCK_CASES.find((x) => x.id === case_id);
    if (!c) return { error: 'Dossier introuvable' };
    if (c.measure_kind !== 'TIG') return { error: 'Ce dossier n\'est pas de type TIG' };
    if (tig_site_id) {
      const site = MOCK_TIG_SITES.find((s) => s.id === tig_site_id);
      if (!site) return { error: 'Site introuvable' };
      if (!site.is_active) return { error: 'Ce site est désactivé. Choisissez un site actif.' };
      const occ = MOCK_CASES.filter((x) =>
        x.tig_site_id === tig_site_id && ['ACTIVE', 'VIOLATION'].includes(x.status)
      ).length;
      if (occ >= site.capacity) return { error: `Ce site est complet (${occ}/${site.capacity} places).` };
    }
    c.tig_site_id = tig_site_id ?? undefined;
    revalidatePath(`/sigep/dashboard/cases/${case_id}`);
    return;
  }

  const supabase = await getSupabase();
  if (!supabase) return { error: 'Base de données indisponible' };

  const { data: caseRow } = await supabase.from('cases').select('measure_kind').eq('id', case_id).single();
  if (!caseRow) return { error: 'Dossier introuvable' };
  if (caseRow.measure_kind !== 'TIG') return { error: 'Ce dossier n\'est pas de type TIG' };

  if (tig_site_id) {
    const { data: siteRow } = await supabase.from('tig_sites')
      .select('is_active, capacity').eq('id', tig_site_id).single();
    if (!siteRow) return { error: 'Site introuvable' };
    if (!siteRow.is_active) return { error: 'Ce site est désactivé. Choisissez un site actif.' };
    const { count: occ } = await supabase.from('cases')
      .select('id', { count: 'exact', head: true })
      .eq('tig_site_id', tig_site_id).in('status', ['ACTIVE', 'VIOLATION']);
    if ((occ ?? 0) >= siteRow.capacity) {
      return { error: `Ce site est complet (${occ}/${siteRow.capacity} places).` };
    }
  }

  const { error } = await supabase.from('cases').update({ tig_site_id }).eq('id', case_id);
  if (error) return { error: 'Erreur lors de l\'affectation' };
  await writeAudit({ userId: session.id, action: 'ASSIGN_TIG_SITE', tableName: 'cases', recordId: case_id, newData: { tig_site_id } });
  revalidatePath(`/sigep/dashboard/cases/${case_id}`);
}

// ── Hours ordered ────────────────────────────────────────────────────────────

export async function updateTigHoursOrderedAction(formData: FormData): Promise<{ error: string } | void> {
  const session = await getSession();
  if (!session || !canSetMeasureConditions(session.role)) return { error: 'Accès refusé' };

  const case_id           = formData.get('case_id') as string;
  const tig_hours_ordered = parseInt(formData.get('tig_hours_ordered') as string, 10);
  if (!case_id || isNaN(tig_hours_ordered) || tig_hours_ordered < 1 || tig_hours_ordered > 9999) {
    return { error: 'Nombre d\'heures invalide (1–9999)' };
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

// ── Add attendance ────────────────────────────────────────────────────────────

export async function addTigAttendanceAction(formData: FormData): Promise<{ error: string; id?: never } | { id: string; error?: never }> {
  const session = await getSession();
  if (!session || !canLogTigAttendance(session.role)) return { error: 'Accès refusé' };

  const case_id          = formData.get('case_id') as string;
  const tig_site_id      = formData.get('tig_site_id') as string;
  const session_date     = formData.get('session_date') as string;
  const hours_worked     = parseFloat(formData.get('hours_worked') as string);
  const supervisor_notes = (formData.get('supervisor_notes') as string)?.trim() || null;

  if (!case_id || !tig_site_id || !session_date || isNaN(hours_worked) || hours_worked <= 0) {
    return { error: 'Champs obligatoires manquants ou invalides' };
  }
  if (hours_worked > 24) return { error: 'Maximum 24 heures par session' };

  const today = new Date().toISOString().slice(0, 10);
  if (session_date > today) return { error: 'La date ne peut pas être dans le futur' };

  if (isDemoMode()) {
    const { MOCK_TIG_ATTENDANCE, MOCK_CASES } = await import('@/lib/mock/data');
    const c = MOCK_CASES.find((x) => x.id === case_id);
    if (c?.start_date && session_date < c.start_date) {
      return { error: `Date antérieure au début du suivi (${c.start_date})` };
    }
    if (MOCK_TIG_ATTENDANCE.some((a) => a.case_id === case_id && a.session_date === session_date)) {
      return { error: 'Un pointage existe déjà pour cette date.' };
    }
    const newId = `ta-${crypto.randomUUID()}`;
    MOCK_TIG_ATTENDANCE.push({
      id: newId, case_id, tig_site_id, session_date, hours_worked,
      signed_by_id: session.id, supervisor_notes, created_by: session.id,
      created_at: new Date().toISOString(),
    });
    if (c) c.tig_hours_completed = (c.tig_hours_completed ?? 0) + hours_worked;
    revalidatePath(`/sigep/dashboard/cases/${case_id}`);
    revalidatePath(`/sigep/dashboard/tig-sites/${tig_site_id}`);
    return { id: newId };
  }

  const supabase = await getSupabase();
  if (!supabase) return { error: 'Base de données indisponible' };

  // Fetch case info for validation + completion notification
  const { data: caseRow } = await supabase
    .from('cases').select('start_date, judge_id, tig_hours_ordered').eq('id', case_id).single();

  if (caseRow?.start_date && session_date < caseRow.start_date) {
    return { error: `Date antérieure au début du suivi (${caseRow.start_date})` };
  }

  // Duplicate check: one session per case per date
  const { count: dupCount } = await supabase.from('tig_attendance')
    .select('id', { count: 'exact', head: true })
    .eq('case_id', case_id).eq('session_date', session_date);
  if (dupCount && dupCount > 0) {
    return { error: 'Un pointage existe déjà pour cette date. Supprimez-le avant d\'en créer un nouveau.' };
  }

  const { data, error } = await supabase.from('tig_attendance').insert({
    case_id, tig_site_id, session_date, hours_worked, supervisor_notes,
    signed_by_id: session.id,
    created_by: session.id,
  }).select('id').single();

  if (error || !data?.id) return { error: 'Erreur lors de l\'enregistrement du pointage' };

  // Recompute total from source of truth
  const { data: allSessions } = await supabase
    .from('tig_attendance').select('hours_worked').eq('case_id', case_id);
  const total = (allSessions ?? []).reduce((acc: number, r: { hours_worked: number }) => acc + r.hours_worked, 0);
  await supabase.from('cases').update({ tig_hours_completed: total }).eq('id', case_id);

  // Push only on threshold crossing (not on every session after completion)
  if (
    caseRow?.judge_id &&
    caseRow.tig_hours_ordered &&
    total >= caseRow.tig_hours_ordered &&
    (total - hours_worked) < caseRow.tig_hours_ordered
  ) {
    const { sendPushToUser } = await import('@/lib/push');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await sendPushToUser(supabase as any, caseRow.judge_id, {
      title: 'TIG accompli',
      body: `Les heures TIG sont complètes (${total}h / ${caseRow.tig_hours_ordered}h). Action requise.`,
      url: `/sigep/dashboard/cases/${case_id}`,
      tag: `tig-complete-${case_id}`,
    });
  }

  await writeAudit({ userId: session.id, action: 'ADD_TIG_ATTENDANCE', tableName: 'tig_attendance', recordId: data.id, newData: { case_id, session_date, hours_worked } });
  revalidatePath(`/sigep/dashboard/cases/${case_id}`);
  revalidatePath(`/sigep/dashboard/tig-sites/${tig_site_id}`);
  return { id: data.id };
}

// ── Delete attendance ─────────────────────────────────────────────────────────
// JUDGE/SUPER_ADMIN: delete any. OPERATIONAL: own entries from today only.

export async function deleteTigAttendanceAction(formData: FormData): Promise<{ error: string } | void> {
  const session = await getSession();
  if (!session || !canLogTigAttendance(session.role)) return { error: 'Accès refusé' };

  const id      = formData.get('id') as string;
  const case_id = formData.get('case_id') as string;
  if (!id || !case_id) return { error: 'Identifiants manquants' };

  const today = new Date().toISOString().slice(0, 10);
  const isJudicial = canSetMeasureConditions(session.role);

  if (isDemoMode()) {
    const { MOCK_TIG_ATTENDANCE, MOCK_CASES } = await import('@/lib/mock/data');
    const idx = MOCK_TIG_ATTENDANCE.findIndex((a) => a.id === id);
    if (idx === -1) return { error: 'Pointage introuvable' };
    const rec = MOCK_TIG_ATTENDANCE[idx];
    if (!isJudicial) {
      if (rec.created_by !== session.id || rec.session_date !== today) {
        return { error: 'Vous ne pouvez supprimer que vos propres pointages du jour.' };
      }
    }
    const hours = rec.hours_worked;
    const tigSiteId = rec.tig_site_id;
    MOCK_TIG_ATTENDANCE.splice(idx, 1);
    const c = MOCK_CASES.find((x) => x.id === case_id);
    if (c) c.tig_hours_completed = Math.max(0, (c.tig_hours_completed ?? 0) - hours);
    revalidatePath(`/sigep/dashboard/cases/${case_id}`);
    if (tigSiteId) revalidatePath(`/sigep/dashboard/tig-sites/${tigSiteId}`);
    return;
  }

  const supabase = await getSupabase();
  if (!supabase) return { error: 'Base de données indisponible' };

  // Always fetch first — ownership check for OPERATIONAL + tig_site_id for revalidation
  const { data: rec } = await supabase.from('tig_attendance')
    .select('created_by, session_date, tig_site_id')
    .eq('id', id).eq('case_id', case_id).single();
  if (!rec) return { error: 'Pointage introuvable' };

  if (!isJudicial) {
    if (rec.created_by !== session.id || (rec.session_date as string) !== today) {
      return { error: 'Vous ne pouvez supprimer que vos propres pointages du jour.' };
    }
  }

  const { error } = await supabase.from('tig_attendance').delete().eq('id', id).eq('case_id', case_id);
  if (error) return { error: 'Erreur lors de la suppression' };

  // Recompute total
  const { data: allSessions } = await supabase
    .from('tig_attendance').select('hours_worked').eq('case_id', case_id);
  const total = (allSessions ?? []).reduce((acc: number, r: { hours_worked: number }) => acc + r.hours_worked, 0);
  await supabase.from('cases').update({ tig_hours_completed: total }).eq('id', case_id);

  await writeAudit({ userId: session.id, action: 'DELETE_TIG_ATTENDANCE', tableName: 'tig_attendance', recordId: id });
  revalidatePath(`/sigep/dashboard/cases/${case_id}`);
  if (rec.tig_site_id) revalidatePath(`/sigep/dashboard/tig-sites/${rec.tig_site_id as string}`);
}
