import { redirect } from 'next/navigation';
import { Bell, BellOff, CheckCircle2, AlertTriangle, Wifi, Battery, Shield, Zap } from 'lucide-react';
import { getSession } from '@/lib/auth/session';
import { fetchAlerts } from '@/lib/mock/helpers';
import NotificationPrefsForm from './NotificationPrefsForm';
import type { AlertType } from '@/lib/supabase/types';

export const metadata = { title: 'Notifications & Escalades — SIGEP' };
export const revalidate = 0;

const ALERT_META: Record<AlertType, { label: string; icon: typeof Bell; color: string; desc: string }> = {
  GEOFENCE_EXIT:    { label: 'Sortie de zone',      icon: Shield,        color: 'text-red-600',    desc: 'Violation de périmètre GPS ou BLE' },
  TAMPER_DETECTED:  { label: 'Anti-sabotage',        icon: AlertTriangle, color: 'text-orange-600', desc: 'Tentative de retrait ou d\'altération du bracelet' },
  HEALTH_CRITICAL:  { label: 'Santé critique',       icon: Zap,           color: 'text-red-700',    desc: 'Anomalie critique détectée sur le dispositif' },
  BATTERY_LOW:      { label: 'Batterie faible',      icon: Battery,       color: 'text-amber-600',  desc: 'Batterie < 20% — risque de déconnexion' },
  SIGNAL_LOST:      { label: 'Signal perdu',         icon: Wifi,          color: 'text-gray-600',   desc: 'Connexion MQTT interrompue > 15 min' },
  PANIC_BUTTON:     { label: 'Bouton panique',       icon: Bell,          color: 'text-red-800',    desc: 'Déclenchement manuel par l\'individu' },
};

function formatDT(iso: string) {
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

export default async function NotificationsPage() {
  const session = await getSession();
  if (!session) redirect('/sigep/dashboard');

  const alerts = await fetchAlerts(session.role);
  const recent = alerts.slice(0, 20);
  const unread = alerts.filter((a) => !a.is_resolved).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Notifications & Escalades</h2>
          <p className="text-sm text-gray-500 mt-0.5">Préférences de notification et historique des alertes reçues</p>
        </div>
        {unread > 0 && (
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-1.5">
            <Bell className="w-4 h-4" />
            {unread} alerte{unread > 1 ? 's' : ''} non résolue{unread > 1 ? 's' : ''}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Preferences */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-50">
              <h3 className="font-semibold text-gray-900 text-sm">Préférences de notification</h3>
              <p className="text-xs text-gray-400 mt-0.5">Choisissez les alertes à recevoir</p>
            </div>
            <NotificationPrefsForm />
          </div>

          {/* Escalation logic */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Chaîne d&apos;escalade</h3>
            <ol className="space-y-3">
              {[
                { step: '1', label: 'Agent opérationnel', desc: 'Notification immédiate', color: 'bg-emerald-600' },
                { step: '2', label: 'Juge référent',      desc: 'Après 30 min sans résolution', color: 'bg-blue-600' },
                { step: '3', label: 'SUPER_ADMIN',        desc: 'Après 2h (sévérité ≥ 4)', color: 'bg-orange-600' },
              ].map((item) => (
                <li key={item.step} className="flex items-start gap-3">
                  <span className={`w-6 h-6 rounded-full ${item.color} text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5`}>
                    {item.step}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-gray-800">{item.label}</p>
                    <p className="text-xs text-gray-500">{item.desc}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>

        {/* Recent notifications */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 text-sm">Flux de notifications récentes</h3>
              <span className="text-xs text-gray-400">{recent.length} entrées</span>
            </div>
            {recent.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-center gap-2">
                <BellOff className="w-8 h-8 text-gray-200" />
                <p className="text-sm text-gray-400">Aucune notification</p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-50">
                {recent.map((alert) => {
                  const meta = ALERT_META[alert.alert_type];
                  const Icon = meta.icon;
                  return (
                    <li key={alert.id} className={`px-5 py-3 flex items-start gap-3 ${alert.is_resolved ? 'opacity-50' : ''}`}>
                      <div className={`w-8 h-8 rounded-xl bg-gray-50 flex items-center justify-center flex-shrink-0`}>
                        <Icon className={`w-4 h-4 ${meta.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-xs font-semibold ${meta.color}`}>{meta.label}</span>
                          <span className="text-[10px] font-mono text-gray-400">{alert.case_id}</span>
                          {alert.is_resolved && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-600 font-medium">
                              <CheckCircle2 className="w-3 h-3" /> Résolu
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-600 mt-0.5 truncate">{alert.description}</p>
                      </div>
                      <span className="text-[10px] text-gray-400 whitespace-nowrap flex-shrink-0">
                        {formatDT(alert.triggered_at)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
