'use client';

import { useState, useActionState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import {
  ArrowLeft, Bluetooth, MapPin, ShieldAlert, ShieldCheck,
  Circle, Pentagon, Info,
} from 'lucide-react';
import { createGeofenceAction } from '../actions';
import type { DrawnShape } from '@/components/geofences/GeofenceDrawMap';

const GeofenceDrawMap = dynamic(
  () => import('@/components/geofences/GeofenceDrawMap'),
  { ssr: false, loading: () => <div className="h-full flex items-center justify-center bg-slate-800 rounded-xl text-slate-400 text-sm">Chargement de la carte...</div> }
);

type GeoType = 'GPS_ZONE' | 'BLE_DOMICILE';
type ShapeType = 'POLYGON' | 'CIRCLE';

const INPUT = 'w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent';

export default function NewGeofencePage() {
  const [state, formAction, isPending] = useActionState(createGeofenceAction, null);

  const [geoType, setGeoType]   = useState<GeoType>('GPS_ZONE');
  const [shapeType, setShape]   = useState<ShapeType>('POLYGON');
  const [isExclusion, setExcl]  = useState(false);
  const [drawnShape, setDrawn]  = useState<DrawnShape | null>(null);

  // When geofence type changes, auto-switch to matching shape
  function handleGeoType(t: GeoType) {
    setGeoType(t);
    setShape(t === 'BLE_DOMICILE' ? 'CIRCLE' : 'POLYGON');
    setDrawn(null);
  }

  function handleShape(s: ShapeType) {
    setShape(s);
    setDrawn(null);
  }

  const onShapeDrawn = useCallback((shape: DrawnShape) => setDrawn(shape), []);

  const drawMode = shapeType === 'CIRCLE' ? 'circle' : 'polygon';

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link href="/sigep/dashboard/geofences" className="inline-flex items-center gap-1.5 text-slate-400 hover:text-white text-sm mb-4 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Retour aux géofences
        </Link>
        <h1 className="text-2xl font-bold text-white">Nouvelle géofence</h1>
        <p className="text-slate-400 text-sm mt-1">
          Tracez une zone sur la carte puis configurez ses paramètres.
        </p>
      </div>

      <form action={formAction}>
        {/* Hidden shape data */}
        <input type="hidden" name="geofence_type" value={geoType} />
        <input type="hidden" name="shape_type"    value={shapeType} />
        <input type="hidden" name="is_exclusion"  value={String(isExclusion)} />
        {drawnShape?.type === 'circle' && (
          <>
            <input type="hidden" name="center_lat" value={drawnShape.center[0]} />
            <input type="hidden" name="center_lon" value={drawnShape.center[1]} />
            <input type="hidden" name="radius_m"   value={drawnShape.radius_m} />
          </>
        )}
        {drawnShape?.type === 'polygon' && (
          <input type="hidden" name="coordinates" value={JSON.stringify(drawnShape.coordinates)} />
        )}

        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">

          {/* ── Left panel: configuration ────────────────────────────── */}
          <div className="xl:col-span-2 space-y-4">

            {/* Type de géofence */}
            <div className="bg-slate-900 border border-slate-700/60 rounded-2xl p-5 space-y-3">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                1 — Type de périmètre
              </h2>
              <div className="grid grid-cols-2 gap-3">
                {/* GPS Zone */}
                <button
                  type="button"
                  onClick={() => handleGeoType('GPS_ZONE')}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 text-xs font-semibold transition-all ${
                    geoType === 'GPS_ZONE'
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300'
                      : 'border-slate-700 text-slate-500 hover:border-slate-600'
                  }`}
                >
                  <MapPin className="w-6 h-6" />
                  <span>Zone GPS</span>
                  <span className="text-[10px] font-normal text-slate-500 text-center leading-tight">
                    TIG, déplacements, exclusions
                  </span>
                </button>
                {/* BLE Domicile */}
                <button
                  type="button"
                  onClick={() => handleGeoType('BLE_DOMICILE')}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 text-xs font-semibold transition-all ${
                    geoType === 'BLE_DOMICILE'
                      ? 'border-blue-500 bg-blue-500/10 text-blue-300'
                      : 'border-slate-700 text-slate-500 hover:border-slate-600'
                  }`}
                >
                  <Bluetooth className="w-6 h-6" />
                  <span>Périmètre BLE</span>
                  <span className="text-[10px] font-normal text-slate-500 text-center leading-tight">
                    Assignation à domicile
                  </span>
                </button>
              </div>

              {geoType === 'BLE_DOMICILE' && (
                <div className="flex items-start gap-2 bg-blue-500/10 border border-blue-500/20 rounded-xl p-3">
                  <Info className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-blue-300 leading-relaxed">
                    Ce périmètre sera couplé à la balise BLE installée au domicile. Utilisez un cercle et réglez le rayon selon la taille du logement (50 – 200 m).
                  </p>
                </div>
              )}
            </div>

            {/* Forme */}
            <div className="bg-slate-900 border border-slate-700/60 rounded-2xl p-5 space-y-3">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                2 — Forme du tracé
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleShape('POLYGON')}
                  className={`flex items-center gap-2.5 p-3 rounded-xl border-2 text-xs font-semibold transition-all ${
                    shapeType === 'POLYGON'
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300'
                      : 'border-slate-700 text-slate-500 hover:border-slate-600'
                  }`}
                >
                  <Pentagon className="w-4 h-4" /> Polygone
                </button>
                <button
                  type="button"
                  onClick={() => handleShape('CIRCLE')}
                  className={`flex items-center gap-2.5 p-3 rounded-xl border-2 text-xs font-semibold transition-all ${
                    shapeType === 'CIRCLE'
                      ? 'border-blue-500 bg-blue-500/10 text-blue-300'
                      : 'border-slate-700 text-slate-500 hover:border-slate-600'
                  }`}
                >
                  <Circle className="w-4 h-4" /> Cercle
                </button>
              </div>

              {/* Inclusion/Exclusion */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setExcl(false)}
                  className={`flex items-center gap-2 p-3 rounded-xl border-2 text-xs font-semibold transition-all ${
                    !isExclusion
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300'
                      : 'border-slate-700 text-slate-500 hover:border-slate-600'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4" /> Autorisée
                </button>
                <button
                  type="button"
                  onClick={() => setExcl(true)}
                  className={`flex items-center gap-2 p-3 rounded-xl border-2 text-xs font-semibold transition-all ${
                    isExclusion
                      ? 'border-red-500 bg-red-500/10 text-red-300'
                      : 'border-slate-700 text-slate-500 hover:border-slate-600'
                  }`}
                >
                  <ShieldAlert className="w-4 h-4" /> Interdite
                </button>
              </div>
            </div>

            {/* Détails */}
            <div className="bg-slate-900 border border-slate-700/60 rounded-2xl p-5 space-y-4">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                3 — Informations
              </h2>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Nom de la zone *</label>
                <input name="name" type="text" required placeholder="Ex : Domicile — Dapoya" className={INPUT} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Référence dossier *</label>
                <input name="case_id" type="text" required placeholder="c-0001" className={INPUT} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">ID Bracelet / Balise (optionnel)</label>
                <input name="device_id" type="text" placeholder="d-0001" className={INPUT} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Actif depuis</label>
                  <input name="active_start" type="time" className={INPUT} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Jusqu&apos;à</label>
                  <input name="active_end" type="time" className={INPUT} />
                </div>
              </div>
            </div>

            {/* Shape status + submit */}
            <div className="bg-slate-900 border border-slate-700/60 rounded-2xl p-4 space-y-3">
              {drawnShape ? (
                <div className="flex items-center gap-2 text-xs text-emerald-400">
                  <ShieldCheck className="w-4 h-4" />
                  {drawnShape.type === 'circle'
                    ? `Cercle tracé — rayon ${drawnShape.radius_m} m`
                    : `Polygone tracé — ${drawnShape.coordinates.length - 1} points`
                  }
                </div>
              ) : (
                <p className="text-xs text-amber-400 flex items-center gap-2">
                  <Info className="w-4 h-4" />
                  Utilisez les outils de dessin sur la carte →
                </p>
              )}

              {state?.error && (
                <p className="text-xs text-red-400">{state.error}</p>
              )}

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={isPending || !drawnShape}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
                >
                  {isPending ? 'Enregistrement...' : 'Enregistrer la géofence'}
                </button>
                <Link
                  href="/sigep/dashboard/geofences"
                  className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-400 text-sm hover:bg-slate-800 transition-colors"
                >
                  Annuler
                </Link>
              </div>
            </div>
          </div>

          {/* ── Right panel: interactive map ─────────────────────────── */}
          <div className="xl:col-span-3">
            <div className="bg-slate-900 border border-slate-700/60 rounded-2xl overflow-hidden" style={{ height: 680 }}>
              {/* Map toolbar hint */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-700/60">
                <div className={`w-2 h-2 rounded-full ${geoType === 'BLE_DOMICILE' ? 'bg-blue-400' : 'bg-emerald-400'} animate-pulse`} />
                <span className="text-xs text-slate-400">
                  {shapeType === 'CIRCLE'
                    ? 'Cliquez pour placer le centre, puis faites glisser pour définir le rayon'
                    : 'Cliquez pour ajouter des points — double-cliquez pour fermer le polygone'}
                </span>
              </div>
              <div style={{ height: 'calc(100% - 45px)' }}>
                <GeofenceDrawMap
                  drawMode={drawMode}
                  onShapeDrawn={onShapeDrawn}
                />
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
