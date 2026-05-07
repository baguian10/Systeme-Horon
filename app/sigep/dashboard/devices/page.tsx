import { redirect } from 'next/navigation';
import { Wifi, WifiOff, Battery, Package, Bluetooth, Radio, Signal } from 'lucide-react';
import { getSession } from '@/lib/auth/session';
import { canViewDevices } from '@/lib/auth/permissions';
import { fetchAllDevices, fetchCases } from '@/lib/mock/helpers';

export const metadata = { title: 'Bracelets & Balises BLE — SIGEP' };
export const revalidate = 0;

export default async function DevicesPage() {
  const session = await getSession();
  if (!session || !canViewDevices(session.role)) redirect('/sigep/dashboard');

  const [devices, cases] = await Promise.all([
    fetchAllDevices(),
    fetchCases(session.role, session.id),
  ]);

  const caseMap = new Map(cases.map((c) => [c.id, c]));
  const online    = devices.filter((d) => d.is_online).length;
  const unassigned = devices.filter((d) => !d.case_id).length;

  function timeAgo(iso: string) {
    const d = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (d < 60) return `${d}s`;
    if (d < 3600) return `${Math.floor(d / 60)}min`;
    if (d < 86400) return `${Math.floor(d / 3600)}h`;
    return `${Math.floor(d / 86400)}j`;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Inventaire des dispositifs</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          {devices.length} bracelet{devices.length !== 1 ? 's' : ''} · {online} en ligne · {unassigned} non assigné{unassigned !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total',        value: devices.length,           color: 'text-gray-700',   bg: 'bg-gray-50 border-gray-100' },
          { label: 'En ligne',     value: online,                   color: 'text-green-700',  bg: 'bg-green-50 border-green-100' },
          { label: 'Hors ligne',   value: devices.length - online,  color: 'text-slate-600',  bg: 'bg-slate-50 border-slate-100' },
          { label: 'Non assignés', value: unassigned,               color: 'text-amber-700',  bg: 'bg-amber-50 border-amber-100' },
        ].map((t) => (
          <div key={t.label} className={`${t.bg} border rounded-2xl p-4 text-center`}>
            <p className={`text-2xl font-bold ${t.color}`}>{t.value}</p>
            <p className="text-xs text-gray-500 mt-1">{t.label}</p>
          </div>
        ))}
      </div>

      {/* Device table */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <Package className="w-4 h-4 text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-700">Bracelets électroniques</h3>
        </div>
        {devices.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-10 text-gray-400">
            <Package className="w-5 h-5" />
            <span className="text-sm">Aucun bracelet enregistré</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">IMEI</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Modèle</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Statut</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Batterie</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Firmware</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Dossier assigné</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Dernier contact</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {devices.map((d) => {
                  const assignedCase = d.case_id ? caseMap.get(d.case_id) : undefined;
                  const bat = d.battery_pct ?? 0;
                  return (
                    <tr key={d.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-5 py-3.5 font-mono text-xs text-gray-700">{d.imei}</td>
                      <td className="px-5 py-3.5 text-xs text-gray-600">{d.model}</td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${d.is_online ? 'text-green-600' : 'text-gray-400'}`}>
                          {d.is_online ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
                          {d.is_online ? 'En ligne' : 'Hors ligne'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${bat < 20 ? 'bg-red-400' : bat < 50 ? 'bg-amber-400' : 'bg-green-400'}`}
                              style={{ width: `${bat}%` }}
                            />
                          </div>
                          <span className={`text-xs font-medium ${bat < 20 ? 'text-red-600' : 'text-gray-600'}`}>
                            <Battery className="inline w-3 h-3 mr-0.5" />{bat}%
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-gray-400 font-mono">{d.firmware_ver ?? '—'}</td>
                      <td className="px-5 py-3.5">
                        {assignedCase ? (
                          <span className="font-mono text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">
                            {assignedCase.case_number}
                          </span>
                        ) : (
                          <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md">Disponible</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-gray-400">
                        {d.last_seen_at ? `${timeAgo(d.last_seen_at)} ago` : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ══ BLE BEACON CONFIG PANEL ══════════════════════════════════════════ */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bluetooth className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-semibold text-gray-700">Configuration Beacon BLE</h3>
            <span className="ml-2 text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full uppercase tracking-wide">Assignation à domicile</span>
          </div>
          <span className="text-xs text-gray-400">Intégration API en attente</span>
        </div>

        <div className="p-6">
          <p className="text-sm text-gray-500 mb-6 leading-relaxed">
            Configurez les balises Bluetooth Low Energy (BLE) pour les ordonnances d&apos;assignation à domicile. Chaque balise est appairée avec le bracelet électronique du bénéficiaire pour assurer un suivi de présence ultra-précis en intérieur.
          </p>

          {/* Beacon form fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Adresse MAC de la balise</label>
              <input
                type="text"
                placeholder="AA:BB:CC:DD:EE:FF"
                disabled
                className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 text-gray-400 font-mono placeholder:text-gray-300 cursor-not-allowed"
              />
              <p className="text-[10px] text-gray-400">Identifiant matériel unique de la balise BLE</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">UUID du service</label>
              <input
                type="text"
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                disabled
                className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 text-gray-400 font-mono placeholder:text-gray-300 cursor-not-allowed"
              />
              <p className="text-[10px] text-gray-400">UUID standardisé du profil BLE SIGEP</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Portée de détection (mètres)</label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  placeholder="10"
                  min={5}
                  max={50}
                  disabled
                  className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 text-gray-400 placeholder:text-gray-300 cursor-not-allowed"
                />
                <div className="flex items-center gap-1.5 text-xs text-gray-400 whitespace-nowrap">
                  <Signal className="w-3.5 h-3.5" /> 5 – 50 m
                </div>
              </div>
              <p className="text-[10px] text-gray-400">Rayon dans lequel la présence est confirmée</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Puissance TX (dBm)</label>
              <input
                type="number"
                placeholder="-59"
                disabled
                className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 text-gray-400 placeholder:text-gray-300 cursor-not-allowed"
              />
              <p className="text-[10px] text-gray-400">Puissance d&apos;émission pour le calcul de proximité RSSI</p>
            </div>

            <div className="md:col-span-2 space-y-1.5">
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Dossier SIGEP associé</label>
              <input
                type="text"
                placeholder="OUAG-2024-XXXX"
                disabled
                className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 text-gray-400 font-mono placeholder:text-gray-300 cursor-not-allowed"
              />
            </div>

            <div className="md:col-span-2">
              <div className="flex items-center justify-between bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">
                <div className="flex items-center gap-2">
                  <Radio className="w-4 h-4 text-slate-400" />
                  <div>
                    <p className="text-sm font-semibold text-slate-700">Statut d&apos;appairage</p>
                    <p className="text-xs text-slate-400">Synchronisation bracelet ↔ balise BLE</p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-400 bg-gray-100 px-3 py-1.5 rounded-lg">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                  Non configuré
                </span>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-5 border-t border-gray-100 flex items-center justify-between">
            <p className="text-xs text-gray-400 italic">
              L&apos;intégration API BLE est en cours de déploiement. Ces champs seront actifs lors de la mise en production complète du module.
            </p>
            <button
              disabled
              className="px-4 py-2 rounded-xl bg-blue-600/30 text-blue-400 text-sm font-semibold cursor-not-allowed"
            >
              Enregistrer la configuration
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
