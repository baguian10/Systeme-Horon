import { redirect } from 'next/navigation';
import { Shield, Wifi, Database, Globe, Lock, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { getSession } from '@/lib/auth/session';
import { canViewParametres } from '@/lib/auth/permissions';
import { getSettings } from '@/lib/settings';
import { fetchServiceStatus } from '@/lib/mock/helpers';
import ActiveSettingsForm from '@/components/settings/ActiveSettingsForm';
import pkg from '@/package.json';

const STATE_META = {
  ok:   { color: 'text-emerald-600', label: 'Opérationnel', Icon: CheckCircle2 },
  warn: { color: 'text-amber-600',   label: 'Dégradé',      Icon: AlertTriangle },
  down: { color: 'text-red-600',     label: 'Hors service', Icon: XCircle },
} as const;

export const metadata = { title: 'Paramètres système — SIGEP' };

function buildSystemInfo() {
  const isDemo = !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  let gpsHost = '—';
  try { gpsHost = new URL(process.env.TRAXBEAN_API_BASE ?? 'https://napi.5gcity.com').host; } catch {}
  return [
    { label: 'Version SIGEP',   value: pkg.version,                          icon: Shield },
    { label: 'Transport',       value: 'HTTPS (ingest) + Traxbean',          icon: Wifi },
    { label: 'Base de données', value: 'Supabase PostgreSQL',                icon: Database },
    { label: 'Plateforme GPS',  value: gpsHost,                              icon: Globe },
    { label: 'Environnement',   value: isDemo ? 'Démonstration' : 'Production', icon: Lock },
  ];
}

export default async function ParametresPage() {
  const session = await getSession();
  if (!session || !canViewParametres(session.role)) redirect('/sigep/dashboard');

  const [settings, services] = await Promise.all([getSettings(), fetchServiceStatus()]);
  const systemInfo = buildSystemInfo();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Paramètres système</h2>
          <p className="text-sm text-gray-500 mt-0.5">Configuration technique de la plateforme SIGEP — Accès Super Administrateur</p>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">
          <Lock className="w-3.5 h-3.5" />
          Zone sécurisée — Niveau 0
        </span>
      </div>

      <ActiveSettingsForm settings={settings} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* System info */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-50">
              <h3 className="font-semibold text-gray-900 text-sm">Informations système</h3>
            </div>
            <ul className="divide-y divide-gray-50">
              {systemInfo.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.label} className="px-5 py-3 flex items-center gap-3">
                    <Icon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-gray-400 uppercase font-semibold">{item.label}</p>
                      <p className="text-xs font-mono text-gray-700 truncate">{item.value}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Status overview */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">État des services</h3>
            <ul className="space-y-2.5">
              {services.map((s) => {
                const meta = STATE_META[s.state];
                return (
                  <li key={s.label} className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm text-gray-700">{s.label}</p>
                      <p className="text-[10px] text-gray-400 truncate">{s.detail}</p>
                    </div>
                    <span className={`flex items-center gap-1 text-xs font-semibold flex-shrink-0 ${meta.color}`}>
                      <meta.Icon className="w-3.5 h-3.5" />
                      {meta.label}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
      </div>
    </div>
  );
}
