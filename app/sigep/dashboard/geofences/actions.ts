'use server';

import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/auth/session';
import { canManageGeofences, canSetMeasureConditions, allow } from '@/lib/auth/permissions';
import type { Geofence, GeofenceType, GeofenceShape } from '@/lib/supabase/types';

function isDemoMode() {
  return !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
}

// ── Geometry validation (was absent: radius 0/negative, arbitrary JSON and
// out-of-range coordinates were accepted into the enforcement pipeline) ──
function circleError(lat: number, lon: number, r: number): string | null {
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) return 'Latitude invalide';
  if (!Number.isFinite(lon) || lon < -180 || lon > 180) return 'Longitude invalide';
  if (!Number.isFinite(r) || r < 10 || r > 100_000) return 'Rayon invalide (entre 10 m et 100 km)';
  return null;
}

function parseRing(raw: string): { ring?: number[][]; error?: string } {
  let coords: unknown;
  try { coords = JSON.parse(raw); } catch { return { error: 'Données du polygone invalides' }; }
  if (!Array.isArray(coords) || coords.length < 3) return { error: 'Polygone : minimum 3 points' };
  if (coords.length > 500) return { error: 'Polygone trop complexe (max 500 points)' };
  for (const p of coords) {
    if (!Array.isArray(p) || p.length < 2 || !Number.isFinite(p[0]) || !Number.isFinite(p[1])) {
      return { error: 'Point de polygone invalide' };
    }
    if (p[0] < -180 || p[0] > 180 || p[1] < -90 || p[1] > 90) return { error: 'Coordonnées hors limites' };
  }
  return { ring: coords as number[][] };
}

const HM_RE = /^\d{1,2}:\d{2}$/;
function windowError(start: string | null, end: string | null): string | null {
  if ((start && !end) || (!start && end)) return 'Fenêtre horaire incomplète (début ET fin requis)';
  if (start && !HM_RE.test(start)) return 'Heure de début invalide (HH:MM)';
  if (end && !HM_RE.test(end)) return 'Heure de fin invalide (HH:MM)';
  return null;
}

export async function createGeofenceAction(
  _: { error: string } | null,
  formData: FormData,
): Promise<{ error: string } | null> {
  const session = await getSession();
  if (!session || !allow(session, canManageGeofences(session.role), 'geofences')) return { error: 'Accès refusé' };

  const case_id      = formData.get('case_id') as string;
  const device_id    = (formData.get('device_id') as string) || null;
  const name         = (formData.get('name') as string)?.trim();
  const geofence_type = formData.get('geofence_type') as GeofenceType;
  const shape_type   = formData.get('shape_type') as GeofenceShape;
  const is_exclusion = formData.get('is_exclusion') === 'true';
  const active_start = (formData.get('active_start') as string) || null;
  const active_end   = (formData.get('active_end') as string) || null;

  if (!case_id || !name || !geofence_type || !shape_type) {
    return { error: 'Champs obligatoires manquants' };
  }

  let area: Geofence['area']       = null;
  let center_lat: number | null    = null;
  let center_lon: number | null    = null;
  let radius_m:   number | null    = null;

  const wErr = windowError(active_start, active_end);
  if (wErr) return { error: wErr };

  if (shape_type === 'CIRCLE') {
    center_lat = parseFloat(formData.get('center_lat') as string);
    center_lon = parseFloat(formData.get('center_lon') as string);
    radius_m   = parseInt(formData.get('radius_m') as string, 10);
    const cErr = circleError(center_lat, center_lon, radius_m);
    if (cErr) return { error: cErr };
  } else {
    const raw = formData.get('coordinates') as string;
    if (!raw) return { error: 'Polygone non dessiné sur la carte' };
    const parsed = parseRing(raw);
    if (parsed.error || !parsed.ring) return { error: parsed.error ?? 'Polygone invalide' };
    area = { type: 'Polygon', coordinates: [parsed.ring] };
  }

  const newGeo: Geofence = {
    id: `g-${Date.now()}`,
    case_id,
    device_id,
    name,
    geofence_type,
    shape_type,
    is_exclusion,
    area,
    center_lat,
    center_lon,
    radius_m,
    active_start,
    active_end,
    created_by: session.id,
    created_at: new Date().toISOString(),
  };

  if (isDemoMode()) {
    const { MOCK_GEOFENCES, MOCK_CASES } = await import('@/lib/mock/data');
    MOCK_GEOFENCES.push(newGeo);
    const c = MOCK_CASES.find((c) => c.id === case_id);
    if (c) c.geofences = [...(c.geofences ?? []), newGeo];
    revalidatePath('/sigep/dashboard/geofences');
    revalidatePath(`/sigep/dashboard/cases/${case_id}`);
    return null;
  }

  const { createAdminClient } = await import('@/lib/supabase/admin');
  const supabase = createAdminClient();
  if (!supabase) return { error: 'Base de données indisponible' };

  const { error } = await supabase.from('geofences').insert({
    case_id, device_id, name, geofence_type, shape_type,
    is_exclusion, area, center_lat, center_lon, radius_m,
    active_start, active_end, created_by: session.id,
  });

  if (error) return { error: 'Erreur lors de la création de la géofence' };
  { const { writeAudit } = await import('@/lib/audit/log'); await writeAudit({ userId: session.id, action: 'CREATE_GEOFENCE', tableName: 'geofences', recordId: case_id, newData: { name } }); }
  revalidatePath('/sigep/dashboard/geofences');
  revalidatePath(`/sigep/dashboard/cases/${case_id}`);
  return null;
}

export async function updateGeofenceAction(
  _: { error: string } | { ok: true; caseId: string } | null,
  formData: FormData,
): Promise<{ error: string } | { ok: true; caseId: string } | null> {
  const session = await getSession();
  if (!session || !allow(session, canManageGeofences(session.role), 'geofences')) return { error: 'Accès refusé' };

  const geofence_id  = formData.get('geofence_id') as string;
  const case_id      = formData.get('case_id') as string;
  const name         = (formData.get('name') as string)?.trim();
  const shape_type   = formData.get('shape_type') as GeofenceShape;
  const is_exclusion = formData.get('is_exclusion') === 'true';
  if (!geofence_id || !case_id || !name || !shape_type) return { error: 'Champs obligatoires manquants' };

  const update: Record<string, unknown> = { name, is_exclusion, shape_type, area: null, center_lat: null, center_lon: null, radius_m: null };
  if (shape_type === 'CIRCLE') {
    const lat = parseFloat(formData.get('center_lat') as string);
    const lon = parseFloat(formData.get('center_lon') as string);
    const r   = parseInt(formData.get('radius_m') as string, 10);
    const cErr = circleError(lat, lon, r);
    if (cErr) return { error: cErr };
    update.center_lat = lat; update.center_lon = lon; update.radius_m = r;
  } else {
    const raw = formData.get('coordinates') as string;
    if (!raw) return { error: 'Polygone non tracé' };
    const parsed = parseRing(raw);
    if (parsed.error || !parsed.ring) return { error: parsed.error ?? 'Polygone invalide' };
    update.area = { type: 'Polygon', coordinates: [parsed.ring] };
  }

  if (isDemoMode()) {
    const { MOCK_GEOFENCES } = await import('@/lib/mock/data');
    const g = MOCK_GEOFENCES.find((x) => x.id === geofence_id);
    if (g) Object.assign(g, update);
    revalidatePath('/sigep/dashboard/geofences');
    return { ok: true, caseId: case_id };
  }

  const { createAdminClient } = await import('@/lib/supabase/admin');
  const supabase = createAdminClient();
  if (!supabase) return { error: 'Base de données indisponible' };
  const { error } = await supabase.from('geofences').update(update).eq('id', geofence_id).eq('case_id', case_id);
  if (error) return { error: error.message };
  revalidatePath('/sigep/dashboard/geofences');
  if (case_id) revalidatePath(`/sigep/dashboard/cases/${case_id}`);
  return { ok: true, caseId: case_id };
}

// ── Judicial perimeter OBLIGATION (judge defines intent; admin traces) ────────
// Creates a geofence in status REQUESTED. The technical admin then validates /
// refines the precise geometry. Center defaults to the case's last position.
export async function defineObligationAction(
  _: { error: string } | null,
  formData: FormData,
): Promise<{ error: string } | null> {
  const session = await getSession();
  if (!session || !allow(session, canSetMeasureConditions(session.role), 'geofences.define')) return { error: 'Accès refusé' };

  const case_id = formData.get('case_id') as string;
  const name = (formData.get('name') as string)?.trim();
  const is_exclusion = formData.get('is_exclusion') === 'true';
  const radius_m = parseInt(formData.get('radius_m') as string, 10) || 200;
  const active_start = (formData.get('active_start') as string) || null;
  const active_end = (formData.get('active_end') as string) || null;
  const request_note = (formData.get('request_note') as string)?.trim() || null;
  if (!case_id || !name) return { error: 'Dossier et libellé requis' };

  if (isDemoMode()) return null;
  const { createAdminClient } = await import('@/lib/supabase/admin');
  const supabase = createAdminClient();
  if (!supabase) return { error: 'Base de données indisponible' };

  // Center = the device's last known position for this case (judge stays non-technical).
  let { data: pos } = await supabase
    .from('positions').select('latitude, longitude').eq('case_id', case_id)
    .order('recorded_at', { ascending: false }).limit(1).maybeSingle();
  // Fallback: no position under this case yet (bracelet just reassigned → its
  // history carries the old case_id). Use the assigned device's last fix.
  if (!pos) {
    const { data: dev } = await supabase.from('devices').select('id').eq('case_id', case_id).maybeSingle();
    const deviceId = (dev as { id?: string } | null)?.id;
    if (deviceId) {
      const { data: dpos } = await supabase
        .from('positions').select('latitude, longitude').eq('device_id', deviceId)
        .order('recorded_at', { ascending: false }).limit(1).maybeSingle();
      pos = dpos;
    }
  }
  const center_lat = pos?.latitude ?? 12.3714;
  const center_lon = pos?.longitude ?? -1.5197;

  const { error } = await supabase.from('geofences').insert({
    case_id, name, geofence_type: 'GPS_ZONE', shape_type: 'CIRCLE',
    is_exclusion, center_lat, center_lon, radius_m,
    active_start, active_end, created_by: session.id, defined_by: session.id,
    status: 'REQUESTED', request_note,
  });
  if (error) return { error: error.message };
  const { writeAudit } = await import('@/lib/audit/log');
  await writeAudit({ userId: session.id, action: 'DEFINE_OBLIGATION', tableName: 'geofences', recordId: case_id, newData: { name, is_exclusion } });
  revalidatePath(`/sigep/dashboard/cases/${case_id}`);
  return null;
}

// Admin validates a requested obligation → ACTIVE (enforced).
export async function validateGeofenceAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session || !allow(session, canManageGeofences(session.role), 'geofences')) return;
  const geofence_id = formData.get('geofence_id') as string;
  const case_id = formData.get('case_id') as string;
  if (!geofence_id || !case_id) return;
  if (isDemoMode()) return;
  const { createAdminClient } = await import('@/lib/supabase/admin');
  const supabase = createAdminClient();
  if (!supabase) return;
  await supabase.from('geofences').update({ status: 'ACTIVE' }).eq('id', geofence_id).eq('case_id', case_id);
  const { writeAudit } = await import('@/lib/audit/log');
  await writeAudit({ userId: session.id, action: 'VALIDATE_GEOFENCE', tableName: 'geofences', recordId: geofence_id });
  revalidatePath('/sigep/dashboard/geofences');
  if (case_id) revalidatePath(`/sigep/dashboard/cases/${case_id}`);
}

export async function deleteGeofenceAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session || !allow(session, canManageGeofences(session.role), 'geofences')) return;

  const geofence_id = formData.get('geofence_id') as string;
  const case_id     = formData.get('case_id') as string;
  if (!geofence_id || !case_id) return;

  if (isDemoMode()) {
    const { MOCK_GEOFENCES, MOCK_CASES } = await import('@/lib/mock/data');
    const idx = MOCK_GEOFENCES.findIndex((g) => g.id === geofence_id);
    if (idx !== -1) MOCK_GEOFENCES.splice(idx, 1);
    const c = MOCK_CASES.find((c) => c.id === case_id);
    if (c?.geofences) c.geofences = c.geofences.filter((g) => g.id !== geofence_id);
    revalidatePath('/sigep/dashboard/geofences');
    if (case_id) revalidatePath(`/sigep/dashboard/cases/${case_id}`);
    return;
  }

  const { createAdminClient } = await import('@/lib/supabase/admin');
  const supabase = createAdminClient();
  if (!supabase) return;
  await supabase.from('geofences').delete().eq('id', geofence_id).eq('case_id', case_id);
  { const { writeAudit } = await import('@/lib/audit/log'); await writeAudit({ userId: session.id, action: 'DELETE_GEOFENCE', tableName: 'geofences', recordId: geofence_id }); }
  revalidatePath('/sigep/dashboard/geofences');
  if (case_id) revalidatePath(`/sigep/dashboard/cases/${case_id}`);
}
