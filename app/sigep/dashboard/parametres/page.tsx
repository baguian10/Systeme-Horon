import { redirect } from 'next/navigation';
import { Settings, Shield, Wifi, Clock, Bell, Database, Globe, Lock, CheckCircle2 } from 'lucide-react';
import { getSession } from '@/lib/auth/session';
import { canViewParametres } from '@/lib/auth/permissions';
import ParametresForm from './ParametresForm';

export const metadata = { title: 'Paramètres système — SIGEP' };

const SYSTEM_INFO = [
  { label: 'Version SIGEP',        value: '2.5.0',                icon: Shield },
  { label: 'Protocole',            value: 'MQTT over TLS 1.3',    icon: Wifi },
  { label: 'Base de données',      value: 'Supabase PostgreSQL 15', icon: Database },
  { label: 'Serveur GPS',          value: 'gps.sigep.gov.bf:8883', icon: Globe },
  { label: 'Certificat SSL',       value: 'Valide jusqu\'au 31/12/2026', icon: Lock },
];

export default async function ParametresPage() {
  const session = await getSession();
  if (!session || !canViewParametres(session.role)) redirect('/sigep/dashboard');

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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: System info */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-50">
              <h3 className="font-semibold text-gray-900 text-sm">Informations système</h3>
            </div>
            <ul className="divide-y divide-gray-50">
              {SYSTEM_INFO.map((item) => {
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
            <ul className="space-y-2">
              {[
                { label: 'API SIGEP',              ok: true },
                { label: 'Serveur MQTT',           ok: true },
                { label: 'Base de données',        ok: true },
                { label: 'Géofencing temps réel',  ok: true },
                { label: 'Notifications push',     ok: true },
                { label: 'Export / Rapports PDF',  ok: true },
              ].map((s) => (
                <li key={s.label} className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">{s.label}</span>
                  <span className={`flex items-center gap-1 text-xs font-semibold ${s.ok ? 'text-emerald-600' : 'text-red-600'}`}>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {s.ok ? 'Opérationnel' : 'Dégradé'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Right: Config params */}
        <div className="lg:col-span-2">
          <ParametresForm />
        </div>
      </div>
    </div>
  );
}
