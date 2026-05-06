import { redirect } from 'next/navigation';
import { Wifi, WifiOff, Battery, Package } from 'lucide-react';
import { getSession } from '@/lib/auth/session';
import { canViewDevices } from '@/lib/auth/permissions';
import { fetchAllDevices, fetchCases } from '@/lib/mock/helpers';

export const metadata = { title: 'Bracelets — SIGEP' };
export const revalidate = 0;

export default async function DevicesPage() {
  const session = await getSession();
  if (!session || !canViewDevices(session.role)) redirect('/sigep/dashboard');

  const [devices, cases] = await Promise.all([
    fetchAllDevices(),
    fetchCases(session.role, session.id),
  ]);

  const caseMap = new Map(cases.map((c) => [c.id, c]));
  const online = devices.filter((d) => d.is_online).length;
  const unassigned = devices.filter((d) => !d.case_id).length;

  function timeAgo(iso: string) {
    const d = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (d < 60) return `${d}s`;
    if (d < 3600) return `${Math.floor(d / 60)}min`;
    if (d < 86400) return `${Math.floor(d / 3600)}h`;
    return `${Math.floor(d / 86400)}j`;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Inventaire des bracelets</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {devices.length} dispositif{devices.length !== 1 ? 's' : ''} · {online} en ligne · {unassigned} non assigné{unassigned !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: devices.length, color: 'text-gray-700', bg: 'bg-gray-50' },
          { label: 'En ligne', value: online, color: 'text-green-700', bg: 'bg-green-50' },
          { label: 'Hors ligne', value: devices.length - online, color: 'text-slate-600', bg: 'bg-slate-50' },
          { label: 'Non assignés', value: unassigned, color: 'text-amber-700', bg: 'bg-amber-50' },
        ].map((t) => (
          <div key={t.label} className={`${t.bg} rounded-2xl p-4 text-center`}>
            <p className={`text-2xl font-bold ${t.color}`}>{t.value}</p>
            <p className="text-xs text-gray-500 mt-1">{t.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
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
    </div>
  );
}
