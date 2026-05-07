'use client';

import dynamic from 'next/dynamic';
import { useTransition } from 'react';
import Link from 'next/link';
import { Plus, Trash2, ShieldAlert, ShieldCheck, Bluetooth, MapPin, ExternalLink } from 'lucide-react';
import { deleteGeofenceAction } from '@/app/sigep/dashboard/geofences/actions';
import type { Geofence } from '@/lib/supabase/types';

const GeofenceDisplayMap = dynamic(
  () => import('@/components/geofences/GeofenceDisplayMap'),
  { ssr: false, loading: () => <div className="h-full bg-slate-100 animate-pulse rounded-xl" /> }
);

interface Props {
  caseId: string;
  geofences: Geofence[];
  canManage: boolean;
}

export default function GeofenceManager({ caseId, geofences, canManage }: Props) {
  const [isPending, startTransition] = useTransition();

  function handleDelete(formData: FormData) {
    startTransition(async () => {
      await deleteGeofenceAction(formData);
    });
  }

  // Compute a reasonable map center from the geofences
  const mapCenter = (() => {
    const withCoords = geofences.filter((g) => g.center_lat ?? g.area);
    if (withCoords.length === 0) return [12.3647, -1.5332] as [number, number];
    const g = withCoords[0];
    if (g.center_lat && g.center_lon) return [g.center_lat, g.center_lon] as [number, number];
    if (g.area) {
      const [lng, lat] = g.area.coordinates[0][0];
      return [lat, lng] as [number, number];
    }
    return [12.3647, -1.5332] as [number, number];
  })();

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">Géofences ({geofences.length})</h3>
        {canManage && (
          <Link
            href={`/sigep/dashboard/geofences/new?case_id=${caseId}`}
            className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium"
          >
            <Plus className="w-3.5 h-3.5" /> Nouvelle zone
          </Link>
        )}
      </div>

      {/* Mini-map */}
      {geofences.length > 0 && (
        <div style={{ height: 220 }} className="border-b border-gray-50 relative">
          <GeofenceDisplayMap
            geofences={geofences}
            center={mapCenter}
            zoom={15}
            height="220px"
          />
          <Link
            href="/sigep/dashboard/geofences"
            className="absolute bottom-2 right-2 z-[1000] flex items-center gap-1 bg-white/90 backdrop-blur border border-gray-200 rounded-lg px-2 py-1 text-[10px] font-medium text-gray-600 hover:text-gray-900 transition-colors shadow-sm"
          >
            <ExternalLink className="w-3 h-3" /> Ouvrir l&apos;éditeur
          </Link>
        </div>
      )}

      {/* Geofence list */}
      {geofences.length === 0 ? (
        <div className="px-5 py-6 text-center">
          <p className="text-sm text-gray-400 mb-3">Aucune géofence configurée pour ce dossier.</p>
          {canManage && (
            <Link
              href={`/sigep/dashboard/geofences/new?case_id=${caseId}`}
              className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              <Plus className="w-3.5 h-3.5" /> Tracer une première zone sur la carte
            </Link>
          )}
        </div>
      ) : (
        <ul className="divide-y divide-gray-50">
          {geofences.map((g) => (
            <li key={g.id} className="px-5 py-3 flex items-center gap-3">
              {/* Type icon */}
              {g.geofence_type === 'BLE_DOMICILE' ? (
                <Bluetooth className="w-4 h-4 text-blue-400 flex-shrink-0" />
              ) : g.is_exclusion ? (
                <ShieldAlert className="w-4 h-4 text-red-400 flex-shrink-0" />
              ) : (
                <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              )}

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800">{g.name}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {g.geofence_type === 'BLE_DOMICILE' ? (
                    <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">BLE · {g.radius_m} m</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] text-gray-400">
                      <MapPin className="w-3 h-3" /> GPS
                    </span>
                  )}
                  {g.is_exclusion && (
                    <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">Zone interdite</span>
                  )}
                  {g.active_start && (
                    <span className="text-[10px] text-gray-400">{g.active_start} – {g.active_end}</span>
                  )}
                </div>
              </div>

              {canManage && (
                <form action={handleDelete}>
                  <input type="hidden" name="geofence_id" value={g.id} />
                  <input type="hidden" name="case_id"     value={caseId} />
                  <button
                    type="submit"
                    disabled={isPending}
                    title="Supprimer cette zone"
                    className="p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
