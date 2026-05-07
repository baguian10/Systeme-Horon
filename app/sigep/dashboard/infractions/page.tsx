import { redirect } from 'next/navigation';
import Link from 'next/link';
import {
  AlertTriangle, MapPin, Clock, ShieldAlert,
  Zap, WifiOff, Battery, AlertCircle,
} from 'lucide-react';
import { getSession } from '@/lib/auth/session';
import { canViewViolations } from '@/lib/auth/permissions';
import { fetchViolations, fetchCases } from '@/lib/mock/helpers';
import type { AlertType } from '@/lib/supabase/types';

export const metadata = { title: 'Infractions — SIGEP' };
export const revalidate = 0;

const TYPE_META: Record<AlertType, { label: string; icon: typeof AlertTriangle; color: string; bg: string; border: string }> = {
  GEOFENCE_EXIT:   { label: 'Sortie de périmètre',   icon: MapPin,       color: 'text-red-600',    bg: 'bg-red-50',    border: 'border-red-100' },
  TAMPER_DETECTED: { label: 'Tentative de sabotage',  icon: Zap,          color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-100' },
  BATTERY_LOW:     { label: 'Batterie critique',      icon: Battery,      color: 'text-amber-600',  bg: 'bg-amber-50',  border: 'border-amber-100' },
  SIGNAL_LOST:     { label: 'Perte de signal',        icon: WifiOff,      color: 'text-slate-600',  bg: 'bg-slate-50',  border: 'border-slate-100' },
  HEALTH_CRITICAL: { label: 'Urgence médicale',       icon: AlertCircle,  color: 'text-rose-600',   bg: 'bg-rose-50',   border: 'border-rose-100' },
  PANIC_BUTTON:    { label: 'Bouton panique',         icon: ShieldAlert,  color: 'text-red-700',    bg: 'bg-red-100',   border: 'border-red-200' },
};

const SEV_LABEL = ['', 'Faible', 'Modéré', 'Élevé', 'Critique', 'Maximal'];
const SEV_COLOR = ['', 'text-green-600', 'text-yellow-600', 'text-orange-600', 'text-red-600', 'text-red-700'];
const SEV_BG    = ['', 'bg-green-50', 'bg-yellow-50', 'bg-orange-50', 'bg-red-50', 'bg-red-100'];

export default async function InfractionsPage() {
  const session = await getSession();
  if (!session || !canViewViolations(session.role)) redirect('/sigep/dashboard');

  const [violations, cases] = await Promise.all([
    fetchViolations(session.role),
    fetchCases(session.role, session.id),
  ]);

  const caseMap = new Map(cases.map((c) => [c.id, c]));

  const critiques  = violations.filter((v) => v.severity >= 4);
  const moderees   = violations.filter((v) => v.severity === 3);
  const faibles    = violations.filter((v) => v.severity <= 2);

  function formatDT(iso: string) {
    return new Date(iso).toLocaleString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  function timeAgo(iso: string) {
    const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}min`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h`;
    return `${Math.floor(h / 24)}j`;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Historique des infractions</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Toutes les violations enregistrées — sorties de périmètre et tentatives de sabotage
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-400 bg-white border border-gray-100 rounded-lg px-3 py-2">
          <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
          {violations.filter((v) => !v.is_resolved).length} infraction{violations.filter((v) => !v.is_resolved).length !== 1 ? 's' : ''} active{violations.filter((v) => !v.is_resolved).length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Severity tiles */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Critiques (≥4)',  count: critiques.length,  color: 'text-red-700',    bg: 'bg-red-50 border-red-100' },
          { label: 'Modérées (3)',    count: moderees.length,   color: 'text-orange-600', bg: 'bg-orange-50 border-orange-100' },
          { label: 'Faibles (≤2)',    count: faibles.length,    color: 'text-amber-600',  bg: 'bg-amber-50 border-amber-100' },
        ].map((s) => (
          <div key={s.label} className={`rounded-2xl border p-4 ${s.bg}`}>
            <p className={`text-3xl font-bold ${s.color}`}>{s.count}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Timeline */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50">
          <h3 className="font-semibold text-gray-900 text-sm">Chronologie ({violations.length})</h3>
        </div>

        {violations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-center px-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center mb-3">
              <AlertTriangle className="w-5 h-5 text-emerald-500" />
            </div>
            <p className="text-sm font-medium text-gray-700">Aucune infraction enregistrée</p>
            <p className="text-xs text-gray-400 mt-1">Le système n&apos;a détecté aucune violation de périmètre.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {violations.map((v) => {
              const meta    = TYPE_META[v.alert_type] ?? TYPE_META.GEOFENCE_EXIT;
              const Icon    = meta.icon;
              const caseObj = caseMap.get(v.case_id);
              const isOpen  = !v.is_resolved;

              return (
                <div key={v.id} className={`px-5 py-4 flex items-start gap-4 transition-colors hover:bg-gray-50/50 ${isOpen ? 'border-l-4 border-red-400' : 'border-l-4 border-transparent'}`}>

                  {/* Icon */}
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${meta.bg} ${meta.border} border`}>
                    <Icon className={`w-4 h-4 ${meta.color}`} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${meta.bg} ${meta.border} ${meta.color}`}>
                          {meta.label}
                        </span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${SEV_BG[v.severity]} ${SEV_COLOR[v.severity]}`}>
                          Sév. {v.severity} — {SEV_LABEL[v.severity]}
                        </span>
                        {isOpen && (
                          <span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-100 px-1.5 py-0.5 rounded-md animate-pulse">
                            ACTIVE
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-gray-400 flex-shrink-0">
                        <Clock className="w-3 h-3" />
                        {timeAgo(v.triggered_at)}
                      </div>
                    </div>

                    <p className="text-sm text-gray-700 mt-1.5 leading-relaxed">{v.description ?? '—'}</p>

                    <div className="flex items-center gap-4 mt-2 flex-wrap">
                      {caseObj && (
                        <Link
                          href={`/sigep/dashboard/cases/${v.case_id}`}
                          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline font-mono font-semibold"
                        >
                          {caseObj.case_number}
                        </Link>
                      )}
                      {v.position_lat && (
                        <span className="inline-flex items-center gap-1 text-xs text-gray-400 font-mono">
                          <MapPin className="w-3 h-3" />
                          {v.position_lat.toFixed(4)}, {v.position_lon?.toFixed(4)}
                        </span>
                      )}
                      <span className="text-xs text-gray-400">{formatDT(v.triggered_at)}</span>
                      {v.is_resolved && v.resolved_at && (
                        <span className="text-xs text-emerald-600 font-medium">
                          ✓ Résolu {formatDT(v.resolved_at)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Info box */}
      <div className="bg-amber-50 border border-amber-100 rounded-2xl px-5 py-4 flex items-start gap-3">
        <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-amber-800">Conservation des données</p>
          <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
            Conformément au cadre légal burkinabé, les enregistrements d&apos;infractions sont conservés 5 ans après la clôture du dossier judiciaire correspondant.
            Toute consultation est tracée dans le journal d&apos;audit.
          </p>
        </div>
      </div>
    </div>
  );
}
