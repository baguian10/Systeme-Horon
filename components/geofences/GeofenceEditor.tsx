'use client';

import { useActionState, useCallback, useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ShieldAlert, ShieldCheck } from 'lucide-react';
import { updateGeofenceAction } from '@/app/sigep/dashboard/geofences/actions';
import type { DrawnShape } from '@/components/geofences/GeofenceDrawMap';
import type { Geofence } from '@/lib/supabase/types';

const GeofenceDrawMap = dynamic(() => import('@/components/geofences/GeofenceDrawMap'), {
  ssr: false,
  loading: () => <div className="h-full flex items-center justify-center bg-slate-800 rounded-xl text-slate-400 text-sm">Chargement…</div>,
});

const INPUT = 'w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500';

export default function GeofenceEditor({ geofence }: { geofence: Geofence }) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(updateGeofenceAction, null);
  const [name, setName] = useState(geofence.name);
  const [isExclusion, setExcl] = useState(geofence.is_exclusion);
  const [drawn, setDrawn] = useState<DrawnShape | null>(null);
  const onShapeDrawn = useCallback((s: DrawnShape) => setDrawn(s), []);

  useEffect(() => {
    if (state && 'ok' in state) router.push('/sigep/dashboard/geofences');
  }, [state, router]);

  const drawMode = geofence.shape_type === 'CIRCLE' ? 'circle' : 'polygon';
  // Center on the existing geofence.
  const center: [number, number] =
    geofence.center_lat && geofence.center_lon ? [geofence.center_lat, geofence.center_lon]
    : geofence.area ? [geofence.area.coordinates[0][0][1], geofence.area.coordinates[0][0][0]]
    : [12.3647, -1.5332];

  // Shape payload: redrawn shape if any, else keep current.
  const shape = drawn
    ? (drawn.type === 'circle'
        ? { shape_type: 'CIRCLE', center_lat: drawn.center[0], center_lon: drawn.center[1], radius_m: drawn.radius_m, coordinates: '' }
        : { shape_type: 'POLYGON', center_lat: '', center_lon: '', radius_m: '', coordinates: JSON.stringify(drawn.coordinates) })
    : (geofence.shape_type === 'CIRCLE'
        ? { shape_type: 'CIRCLE', center_lat: geofence.center_lat, center_lon: geofence.center_lon, radius_m: geofence.radius_m, coordinates: '' }
        : { shape_type: 'POLYGON', center_lat: '', center_lon: '', radius_m: '', coordinates: JSON.stringify(geofence.area?.coordinates[0] ?? []) });

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <Link href="/sigep/dashboard/geofences" className="inline-flex items-center gap-1.5 text-slate-400 hover:text-white text-sm mb-4">
          <ArrowLeft className="w-3.5 h-3.5" /> Retour
        </Link>
        <h1 className="text-2xl font-bold text-white">Ajuster le périmètre</h1>
        <p className="text-slate-400 text-sm mt-1">Re-tracez la zone sur la carte pour ajuster, ou modifiez le nom/type.</p>
      </div>

      <form action={formAction}>
        <input type="hidden" name="geofence_id" value={geofence.id} />
        <input type="hidden" name="case_id" value={geofence.case_id} />
        <input type="hidden" name="is_exclusion" value={String(isExclusion)} />
        <input type="hidden" name="shape_type" value={shape.shape_type} />
        <input type="hidden" name="center_lat" value={String(shape.center_lat ?? '')} />
        <input type="hidden" name="center_lon" value={String(shape.center_lon ?? '')} />
        <input type="hidden" name="radius_m" value={String(shape.radius_m ?? '')} />
        <input type="hidden" name="coordinates" value={shape.coordinates} />

        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
          <div className="xl:col-span-2 space-y-4">
            <div className="bg-slate-900 border border-slate-700/60 rounded-2xl p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Nom de la zone *</label>
                <input name="name" value={name} onChange={(e) => setName(e.target.value)} required className={INPUT} />
              </div>
              <button type="button" onClick={() => setExcl((v) => !v)} className={`w-full flex items-center gap-2 p-3 rounded-xl border-2 text-xs font-semibold ${isExclusion ? 'border-red-500 bg-red-500/10 text-red-300' : 'border-emerald-500 bg-emerald-500/10 text-emerald-300'}`}>
                {isExclusion ? <ShieldAlert className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                {isExclusion ? 'Zone interdite (exclusion)' : 'Zone autorisée (inclusion)'}
              </button>
              {drawn && <p className="text-xs text-emerald-400">Nouveau tracé prêt.</p>}
              {state && 'error' in state && <p className="text-xs text-red-400">{state.error}</p>}
              <button type="submit" disabled={isPending} className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-sm font-semibold">
                {isPending ? 'Enregistrement…' : 'Enregistrer les ajustements'}
              </button>
            </div>
          </div>

          <div className="xl:col-span-3">
            <div className="bg-slate-900 border border-slate-700/60 rounded-2xl overflow-hidden" style={{ height: 600 }}>
              <GeofenceDrawMap drawMode={drawMode} onShapeDrawn={onShapeDrawn} existingGeofences={[geofence]} center={center} zoom={15} />
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
