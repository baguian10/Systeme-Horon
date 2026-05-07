'use client';

import dynamic from 'next/dynamic';
import type { Geofence } from '@/lib/supabase/types';

const GeofenceDisplayMap = dynamic(
  () => import('./GeofenceDisplayMap'),
  { ssr: false, loading: () => <div className="h-full bg-slate-800/50 animate-pulse rounded-xl" /> }
);

export default function GeofenceMapClient({ geofences }: { geofences: Geofence[] }) {
  return <GeofenceDisplayMap geofences={geofences} zoom={12} />;
}
