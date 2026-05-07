import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Plus, MapPin, Bluetooth, ShieldAlert, ShieldCheck, Clock, Trash2 } from 'lucide-react';
import { getSession } from '@/lib/auth/session';
import { canManageGeofences } from '@/lib/auth/permissions';
import { fetchGeofences, fetchCases } from '@/lib/mock/helpers';
import { deleteGeofenceAction } from './actions';
import GeofenceMapClient from '@/components/geofences/GeofenceMapClient';
import type { Geofence } from '@/lib/supabase/types';

function GeofenceBadge({ g }: { g: Geofence }) {
  if (g.geofence_type === 'BLE_DOMICILE') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/25">
        <Bluetooth className="w-3 h-3" /> BLE Domicile
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
      <MapPin className="w-3 h-3" /> Zone GPS
    </span>
  );
}

function ShapeInfo({ g }: { g: Geofence }) {
  if (g.shape_type === 'CIRCLE' && g.radius_m) {
    return <span className="text-slate-500 text-xs">Rayon : {g.radius_m} m</span>;
  }
  if (g.shape_type === 'POLYGON' && g.area) {
    const pts = g.area.coordinates[0].length - 1;
    return <span className="text-slate-500 text-xs">{pts} points</span>;
  }
  return null;
}

export default async function GeofencesPage() {
  const session = await getSession();
  if (!session) redirect('/sigep/login');

  const canManage = canManageGeofences(session.role);
  const [geofences, cases] = await Promise.all([fetchGeofences(), fetchCases(session.role, session.id)]);

  const gpsZones    = geofences.filter((g) => g.geofence_type === 'GPS_ZONE');
  const bleDomicile = geofences.filter((g) => g.geofence_type === 'BLE_DOMICILE');
  const exclusions  = geofences.filter((g) => g.is_exclusion);

  // Build case lookup for display
  const caseMap = Object.fromEntries(cases.map((c) => [c.id, c.case_number]));

  return (
    <div className="max-w-7xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Géofences</h1>
          <p className="text-slate-400 text-sm mt-1">
            Périmètres GPS et périmètres domicile (BLE) actifs sur le système.
          </p>
        </div>
        {canManage && (
          <Link
            href="/sigep/dashboard/geofences/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-colors shadow-lg shadow-emerald-900/30"
          >
            <Plus className="w-4 h-4" /> Nouvelle géofence
          </Link>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total des zones',     value: geofences.length,    color: 'text-white',        bg: 'bg-slate-800' },
          { label: 'Zones GPS',           value: gpsZones.length,     color: 'text-emerald-400',  bg: 'bg-emerald-500/10' },
          { label: 'Périmètres BLE',      value: bleDomicile.length,  color: 'text-blue-400',     bg: 'bg-blue-500/10' },
          { label: 'Zones d\'exclusion',  value: exclusions.length,   color: 'text-red-400',      bg: 'bg-red-500/10' },
        ].map((s) => (
          <div key={s.label} className={`${s.bg} rounded-2xl p-4 border border-slate-700/40`}>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-slate-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Map overview + table */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">

        {/* Map */}
        <div className="xl:col-span-3 bg-slate-900 border border-slate-700/60 rounded-2xl overflow-hidden" style={{ height: 480 }}>
          <div className="px-4 py-3 border-b border-slate-700/60 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Carte des périmètres actifs</span>
          </div>
          <div style={{ height: 'calc(100% - 45px)' }}>
            <GeofenceMapClient geofences={geofences} />
          </div>
        </div>

        {/* Légende + Table */}
        <div className="xl:col-span-2 space-y-4">
          {/* Legend */}
          <div className="bg-slate-900 border border-slate-700/60 rounded-2xl p-4 space-y-2">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Légende</p>
            {[
              { color: 'bg-emerald-400', label: 'Zone GPS autorisée (TIG / déplacement)' },
              { color: 'bg-blue-400',    label: 'Périmètre BLE domicile (assignation)' },
              { color: 'bg-red-400',     label: 'Zone interdite (exclusion)' },
            ].map((l) => (
              <div key={l.label} className="flex items-center gap-2.5">
                <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${l.color}`} />
                <span className="text-xs text-slate-400">{l.label}</span>
              </div>
            ))}
          </div>

          {/* Geofence list */}
          <div className="bg-slate-900 border border-slate-700/60 rounded-2xl overflow-hidden" style={{ maxHeight: 360, overflowY: 'auto' }}>
            <div className="px-4 py-3 border-b border-slate-700/60">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Liste des zones</p>
            </div>
            {geofences.length === 0 ? (
              <p className="px-4 py-6 text-sm text-slate-500 text-center">Aucune géofence configurée</p>
            ) : (
              <ul className="divide-y divide-slate-800">
                {geofences.map((g) => (
                  <li key={g.id} className="px-4 py-3 flex items-start gap-3">
                    <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                      g.is_exclusion ? 'bg-red-400' : g.geofence_type === 'BLE_DOMICILE' ? 'bg-blue-400' : 'bg-emerald-400'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-white truncate">{g.name}</p>
                        <GeofenceBadge g={g} />
                        {g.is_exclusion && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-300 border border-red-500/25">
                            Exclusion
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        <span className="text-xs text-slate-500">
                          {caseMap[g.case_id] ? `Dossier ${caseMap[g.case_id]}` : g.case_id}
                        </span>
                        <ShapeInfo g={g} />
                        {g.active_start && (
                          <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                            <Clock className="w-3 h-3" />
                            {g.active_start} – {g.active_end}
                          </span>
                        )}
                      </div>
                    </div>
                    {canManage && (
                      <form action={deleteGeofenceAction}>
                        <input type="hidden" name="geofence_id" value={g.id} />
                        <input type="hidden" name="case_id"     value={g.case_id} />
                        <button
                          type="submit"
                          title="Supprimer"
                          className="p-1 text-slate-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
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
        </div>
      </div>

      {/* Detail by type */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* GPS Zones */}
        <div className="bg-slate-900 border border-slate-700/60 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-700/60 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-emerald-400" />
            <h2 className="font-semibold text-white text-sm">Zones GPS ({gpsZones.length})</h2>
          </div>
          <div className="px-5 py-3 space-y-1">
            <p className="text-xs text-slate-500 pb-2 border-b border-slate-800">
              Périmètres géographiques (polygones) pour contrôler les déplacements, les zones TIG autorisées et les zones d&apos;exclusion.
            </p>
            {gpsZones.length === 0 ? (
              <p className="text-xs text-slate-600 py-3">Aucune zone GPS</p>
            ) : gpsZones.map((g) => (
              <div key={g.id} className="flex items-center gap-3 py-2">
                {g.is_exclusion
                  ? <ShieldAlert className="w-4 h-4 text-red-400 flex-shrink-0" />
                  : <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{g.name}</p>
                  <p className="text-xs text-slate-500">
                    {caseMap[g.case_id] ?? g.case_id} · {g.area?.coordinates[0].length ? g.area.coordinates[0].length - 1 : 0} sommets
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* BLE Domicile */}
        <div className="bg-slate-900 border border-slate-700/60 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-700/60 flex items-center gap-2">
            <Bluetooth className="w-4 h-4 text-blue-400" />
            <h2 className="font-semibold text-white text-sm">Périmètres BLE ({bleDomicile.length})</h2>
          </div>
          <div className="px-5 py-3 space-y-1">
            <p className="text-xs text-slate-500 pb-2 border-b border-slate-800">
              Périmètres circulaires couplés à la balise BLE installée au domicile du bénéficiaire. Détection de présence ultra-précise en intérieur.
            </p>
            {bleDomicile.length === 0 ? (
              <p className="text-xs text-slate-600 py-3">Aucun périmètre BLE</p>
            ) : bleDomicile.map((g) => (
              <div key={g.id} className="flex items-center gap-3 py-2">
                <Bluetooth className="w-4 h-4 text-blue-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{g.name}</p>
                  <p className="text-xs text-slate-500">
                    {caseMap[g.case_id] ?? g.case_id} · Rayon {g.radius_m} m
                    {g.active_start ? ` · ${g.active_start} – ${g.active_end}` : ''}
                  </p>
                </div>
                {g.device_id && (
                  <span className="text-[10px] font-mono text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded">
                    {g.device_id}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
