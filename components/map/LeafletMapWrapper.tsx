'use client';

import dynamic from 'next/dynamic';
import type { TrackerMarker } from './TrackingMap';

const TrackingMap = dynamic(() => import('./TrackingMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-gray-900 rounded-2xl flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="w-8 h-8 border-2 border-bf-green border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs text-gray-400">Chargement de la carte…</p>
      </div>
    </div>
  ),
});

export default function LeafletMapWrapper({ markers }: { markers: TrackerMarker[] }) {
  return <TrackingMap markers={markers} />;
}
