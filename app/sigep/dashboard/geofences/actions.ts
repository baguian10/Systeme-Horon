'use server';

import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/auth/session';
import { canManageGeofences } from '@/lib/auth/permissions';
import type { Geofence, GeofenceType, GeofenceShape } from '@/lib/supabase/types';

function isDemoMode() {
  return !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
}

export async function createGeofenceAction(
  _: { error: string } | null,
  formData: FormData,
): Promise<{ error: string } | null> {
  const session = await getSession();
  if (!session || !canManageGeofences(session.role)) return { error: 'Accès refusé' };

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

  if (shape_type === 'CIRCLE') {
    center_lat = parseFloat(formData.get('center_lat') as string);
    center_lon = parseFloat(formData.get('center_lon') as string);
    radius_m   = parseInt(formData.get('radius_m') as string, 10);
    if (isNaN(center_lat) || isNaN(center_lon) || isNaN(radius_m)) {
      return { error: 'Coordonnées du cercle invalides' };
    }
  } else {
    const raw = formData.get('coordinates') as string;
    if (!raw) return { error: 'Polygone non dessiné sur la carte' };
    try {
      const coords: number[][] = JSON.parse(raw);
      area = { type: 'Polygon', coordinates: [coords] };
    } catch {
      return { error: 'Données du polygone invalides' };
    }
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
  revalidatePath('/sigep/dashboard/geofences');
  revalidatePath(`/sigep/dashboard/cases/${case_id}`);
  return null;
}

export async function deleteGeofenceAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session || !canManageGeofences(session.role)) return;

  const geofence_id = formData.get('geofence_id') as string;
  const case_id     = formData.get('case_id') as string;
  if (!geofence_id) return;

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
  await supabase.from('geofences').delete().eq('id', geofence_id);
  revalidatePath('/sigep/dashboard/geofences');
  if (case_id) revalidatePath(`/sigep/dashboard/cases/${case_id}`);
}
