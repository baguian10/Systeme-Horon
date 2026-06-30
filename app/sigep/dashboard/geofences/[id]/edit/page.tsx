import { notFound, redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { canManageGeofences , allow } from '@/lib/auth/permissions';
import GeofenceEditor from '@/components/geofences/GeofenceEditor';
import type { Geofence } from '@/lib/supabase/types';

export default async function EditGeofencePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session || !allow(session, canManageGeofences(session.role), 'geofences')) redirect('/sigep/dashboard');

  let geofence: Geofence | null = null;
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    const { MOCK_GEOFENCES } = await import('@/lib/mock/data');
    geofence = MOCK_GEOFENCES.find((g) => g.id === id) ?? null;
  } else {
    const { createAdminClient } = await import('@/lib/supabase/admin');
    const sb = createAdminClient();
    if (sb) {
      const { data } = await sb.from('geofences').select('*').eq('id', id).single();
      geofence = (data as Geofence) ?? null;
    }
  }
  if (!geofence) notFound();

  return (
    <div className="p-6">
      <GeofenceEditor geofence={geofence} />
    </div>
  );
}
