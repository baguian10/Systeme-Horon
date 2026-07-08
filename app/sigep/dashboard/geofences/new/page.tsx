import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { allow, canManageGeofences } from '@/lib/auth/permissions';
import NewGeofenceClient from './NewGeofenceClient';

export const metadata = { title: 'Nouvelle géofence — SIGEP' };

// Server gate — the form was a bare client component reachable by any
// authenticated role; only the write action was protected.
export default async function NewGeofencePage() {
  const session = await getSession();
  if (!session || !allow(session, canManageGeofences(session.role), 'geofences')) {
    redirect('/sigep/dashboard');
  }
  return <NewGeofenceClient />;
}
