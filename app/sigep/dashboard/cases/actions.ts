'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { canCreateCase, canManageGeofences, canUpdateCaseStatus } from '@/lib/auth/permissions';
import type { CaseStatus } from '@/lib/supabase/types';

const isDemoMode = () => !process.env.NEXT_PUBLIC_SUPABASE_URL;

// ── Create case + individual + optional device assignment ─────────────────────

export async function createCaseAction(
  _: { error: string } | null,
  formData: FormData,
): Promise<{ error: string } | null> {
  const session = await getSession();
  if (!session || !canCreateCase(session.role)) return { error: 'Accès refusé' };

  const full_name = (formData.get('full_name') as string)?.trim();
  const national_id = (formData.get('national_id') as string)?.trim();
  const date_of_birth = formData.get('date_of_birth') as string;
  const address = (formData.get('address') as string)?.trim() || null;
  const device_id = (formData.get('device_id') as string) || null;
  const court_order_date = formData.get('court_order_date') as string;
  const notes = (formData.get('notes') as string)?.trim() || null;

  if (!full_name || !national_id || !date_of_birth || !court_order_date) {
    return { error: 'Veuillez remplir tous les champs obligatoires' };
  }

  if (isDemoMode()) {
    const { MOCK_CASES, MOCK_INDIVIDUALS, MOCK_DEVICES, MOCK_USERS } = await import('@/lib/mock/data');
    const indId = `i-${Date.now()}`;
    const newIndividual = { id: indId, national_id, full_name, date_of_birth, address, created_at: new Date().toISOString() };
    MOCK_INDIVIDUALS.push(newIndividual);

    const caseId = `c-${Date.now()}`;
    const year = new Date().getFullYear();
    const caseNumber = `BJMK-${year}-${String(MOCK_CASES.length + 1).padStart(4, '0')}`;

    let assignedDevice: (typeof MOCK_DEVICES)[number] | undefined;
    if (device_id) {
      const dev = MOCK_DEVICES.find((d) => d.id === device_id);
      if (dev) { dev.case_id = caseId; assignedDevice = dev; }
    }

    const judge = MOCK_USERS.find((u) => u.id === session.id) ?? MOCK_USERS[2];
    MOCK_CASES.push({
      id: caseId, individual_id: indId, judge_id: session.id,
      case_number: caseNumber, status: 'ACTIVE', court_order_date,
      start_date: new Date().toISOString(), end_date: null, notes,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      individual: newIndividual, judge, device: assignedDevice,
      alert_count: 0, geofences: [], last_position: null,
    });

    revalidatePath('/sigep/dashboard/cases');
    redirect(`/sigep/dashboard/cases/${caseId}`);
  }

  const { createAdminClient } = await import('@/lib/supabase/admin');
  const supabase = createAdminClient();
  if (!supabase) return { error: 'Base de données indisponible' };

  const { data: ind, error: indErr } = await supabase
    .from('individuals')
    .insert({ national_id, full_name, date_of_birth, address })
    .select('id').single();
  if (indErr || !ind) return { error: "Erreur lors de la création de l'individu" };

  const year = new Date().getFullYear();
  const { count } = await supabase.from('cases').select('id', { count: 'exact', head: true });
  const caseNumber = `BJMK-${year}-${String((count ?? 0) + 1).padStart(4, '0')}`;

  const { data: newCase, error: caseErr } = await supabase
    .from('cases')
    .insert({
      individual_id: ind.id, judge_id: session.id, case_number: caseNumber,
      status: 'ACTIVE', court_order_date, start_date: new Date().toISOString(), notes,
    })
    .select('id').single();
  if (caseErr || !newCase) return { error: 'Erreur lors de la création du dossier' };

  if (device_id) await supabase.from('devices').update({ case_id: newCase.id }).eq('id', device_id);

  revalidatePath('/sigep/dashboard/cases');
  redirect(`/sigep/dashboard/cases/${newCase.id}`);
}

// ── Status transition ─────────────────────────────────────────────────────────

export async function updateCaseStatusAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session || !canUpdateCaseStatus(session.role)) return;

  const case_id = formData.get('case_id') as string;
  const status = formData.get('status') as CaseStatus;
  if (!case_id || !status) return;

  if (isDemoMode()) {
    const { MOCK_CASES } = await import('@/lib/mock/data');
    const c = MOCK_CASES.find((c) => c.id === case_id);
    if (c) {
      c.status = status;
      c.updated_at = new Date().toISOString();
      if (status === 'TERMINATED') c.end_date = new Date().toISOString();
    }
    revalidatePath(`/sigep/dashboard/cases/${case_id}`);
    revalidatePath('/sigep/dashboard/cases');
    return;
  }

  const { createAdminClient } = await import('@/lib/supabase/admin');
  const supabase = createAdminClient();
  if (!supabase) return;

  await supabase.from('cases').update({
    status, updated_at: new Date().toISOString(),
    ...(status === 'TERMINATED' ? { end_date: new Date().toISOString() } : {}),
  }).eq('id', case_id);

  revalidatePath(`/sigep/dashboard/cases/${case_id}`);
  revalidatePath('/sigep/dashboard/cases');
}

// ── Geofence management ───────────────────────────────────────────────────────

export async function addGeofenceAction(
  _: { error: string } | null,
  formData: FormData,
): Promise<{ error: string } | null> {
  const session = await getSession();
  if (!session || !canManageGeofences(session.role)) return { error: 'Accès refusé' };

  const case_id = formData.get('case_id') as string;
  const name = (formData.get('name') as string)?.trim();
  const is_exclusion = formData.get('is_exclusion') === 'true';
  const center_lat = parseFloat(formData.get('center_lat') as string);
  const center_lon = parseFloat(formData.get('center_lon') as string);
  const radius_km = parseFloat(formData.get('radius_km') as string) || 0.5;
  const active_start = (formData.get('active_start') as string) || null;
  const active_end = (formData.get('active_end') as string) || null;

  if (!case_id || !name || isNaN(center_lat) || isNaN(center_lon)) {
    return { error: 'Champs obligatoires manquants ou invalides' };
  }

  // Approximate square bounding box: 1 km ≈ 0.009°
  const d = radius_km * 0.009;
  const polygon = {
    type: 'Polygon' as const,
    coordinates: [[[center_lon - d, center_lat - d], [center_lon + d, center_lat - d],
      [center_lon + d, center_lat + d], [center_lon - d, center_lat + d],
      [center_lon - d, center_lat - d]]],
  };

  if (isDemoMode()) {
    const { MOCK_GEOFENCES, MOCK_CASES } = await import('@/lib/mock/data');
    const newGeo = {
      id: `g-${Date.now()}`, case_id, name, is_exclusion, area: polygon,
      active_start: active_start || null, active_end: active_end || null,
      created_by: session.id, created_at: new Date().toISOString(),
    };
    MOCK_GEOFENCES.push(newGeo);
    const c = MOCK_CASES.find((c) => c.id === case_id);
    if (c) c.geofences = [...(c.geofences ?? []), newGeo];
    revalidatePath(`/sigep/dashboard/cases/${case_id}`);
    return null;
  }

  const { createAdminClient } = await import('@/lib/supabase/admin');
  const supabase = createAdminClient();
  if (!supabase) return { error: 'Base de données indisponible' };

  const { error } = await supabase.from('geofences').insert({
    case_id, name, is_exclusion, area: polygon,
    active_start: active_start || null, active_end: active_end || null,
    created_by: session.id,
  });

  if (error) return { error: 'Erreur lors de la création de la géofence' };
  revalidatePath(`/sigep/dashboard/cases/${case_id}`);
  return null;
}

export async function deleteGeofenceAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session || !canManageGeofences(session.role)) return;

  const geofence_id = formData.get('geofence_id') as string;
  const case_id = formData.get('case_id') as string;
  if (!geofence_id || !case_id) return;

  if (isDemoMode()) {
    const { MOCK_GEOFENCES, MOCK_CASES } = await import('@/lib/mock/data');
    const idx = MOCK_GEOFENCES.findIndex((g) => g.id === geofence_id);
    if (idx !== -1) MOCK_GEOFENCES.splice(idx, 1);
    const c = MOCK_CASES.find((c) => c.id === case_id);
    if (c) c.geofences = (c.geofences ?? []).filter((g) => g.id !== geofence_id);
    revalidatePath(`/sigep/dashboard/cases/${case_id}`);
    return;
  }

  const { createAdminClient } = await import('@/lib/supabase/admin');
  const supabase = createAdminClient();
  if (!supabase) return;

  await supabase.from('geofences').delete().eq('id', geofence_id);
  revalidatePath(`/sigep/dashboard/cases/${case_id}`);
}
