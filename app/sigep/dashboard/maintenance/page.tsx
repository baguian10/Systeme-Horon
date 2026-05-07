import { redirect } from 'next/navigation';
import { Wrench, Battery, Cpu, Settings, CheckCircle2, AlertTriangle, Clock, Plus, Zap } from 'lucide-react';
import { getSession } from '@/lib/auth/session';
import { canViewMaintenance } from '@/lib/auth/permissions';
import { fetchMaintenanceTickets } from '@/lib/mock/helpers';
import { updateMaintenanceStatusAction } from './actions';
import type { MaintenanceType, MaintenanceStatus } from '@/lib/supabase/types';

export const metadata = { title: 'Maintenance matérielle — SIGEP' };
export const revalidate = 0;

const TYPE_META: Record<MaintenanceType, { label: string; icon: typeof Wrench; color: string }> = {
  BATTERY:     { label: 'Batterie',     icon: Battery,    color: 'text-amber-600' },
  FIRMWARE:    { label: 'Firmware',     icon: Cpu,        color: 'text-blue-600' },
  HARDWARE:    { label: 'Matériel',     icon: Wrench,     color: 'text-orange-600' },
  CALIBRATION: { label: 'Calibrage',   icon: Settings,   color: 'text-purple-600' },
  REPLACEMENT: { label: 'Remplacement', icon: Zap,        color: 'text-red-600' },
};

const STATUS_META: Record<MaintenanceStatus, { label: string; color: string; bg: string }> = {
  PENDING:     { label: 'En attente',   color: 'text-amber-700',   bg: 'bg-amber-50 border-amber-200' },
  IN_PROGRESS: { label: 'En cours',     color: 'text-blue-700',    bg: 'bg-blue-50 border-blue-200' },
  DONE:        { label: 'Terminé',      color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
  CANCELLED:   { label: 'Annulé',       color: 'text-gray-500',    bg: 'bg-gray-50 border-gray-200' },
};

const PRIORITY_META: Record<number, { label: string; color: string; dot: string }> = {
  1: { label: 'Basse',    color: 'text-gray-500',    dot: 'bg-gray-300' },
  2: { label: 'Moyenne',  color: 'text-amber-600',   dot: 'bg-amber-400' },
  3: { label: 'Urgente',  color: 'text-red-600',     dot: 'bg-red-500' },
};

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default async function MaintenancePage() {
  const session = await getSession();
  if (!session || !canViewMaintenance(session.role)) redirect('/sigep/dashboard');

  const tickets = await fetchMaintenanceTickets();

  const open     = tickets.filter((t) => t.status !== 'DONE' && t.status !== 'CANCELLED');
  const done     = tickets.filter((t) => t.status === 'DONE' || t.status === 'CANCELLED');
  const urgent   = open.filter((t) => t.priority === 3);
  const inProg   = open.filter((t) => t.status === 'IN_PROGRESS');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Maintenance matérielle</h2>
          <p className="text-sm text-gray-500 mt-0.5">Suivi des opérations de maintenance des bracelets GPS SIGEP-G3</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Tickets ouverts',  value: open.length,   color: 'text-blue-600',    bg: 'bg-blue-50 border-blue-100' },
          { label: 'Urgents',          value: urgent.length, color: 'text-red-600',     bg: 'bg-red-50 border-red-100' },
          { label: 'En cours',         value: inProg.length, color: 'text-amber-600',   bg: 'bg-amber-50 border-amber-100' },
          { label: 'Terminés',         value: done.length,   color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-100' },
        ].map((k) => (
          <div key={k.label} className={`border rounded-2xl p-4 ${k.bg}`}>
            <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Urgent alert */}
      {urgent.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl px-5 py-4 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-800">{urgent.length} ticket{urgent.length > 1 ? 's' : ''} urgent{urgent.length > 1 ? 's' : ''} nécessite{urgent.length > 1 ? 'nt' : ''} une action immédiate</p>
            <p className="text-xs text-red-700 mt-0.5">
              {urgent.map((t) => `IMEI ${t.device_imei.slice(-6)}: ${TYPE_META[t.maintenance_type].label}`).join(' · ')}
            </p>
          </div>
        </div>
      )}

      {/* Open tickets */}
      {open.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50">
            <h3 className="font-semibold text-gray-900 text-sm">Tickets actifs ({open.length})</h3>
          </div>
          <ul className="divide-y divide-gray-50">
            {open.map((ticket) => {
              const tMeta  = TYPE_META[ticket.maintenance_type];
              const sMeta  = STATUS_META[ticket.status];
              const pMeta  = PRIORITY_META[ticket.priority];
              const TIcon  = tMeta.icon;
              return (
                <li key={ticket.id} className="px-5 py-5">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center flex-shrink-0">
                      <TIcon className={`w-5 h-5 ${tMeta.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${sMeta.bg} ${sMeta.color}`}>
                          {sMeta.label}
                        </span>
                        <span className={`flex items-center gap-1 text-[10px] font-bold ${pMeta.color}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${pMeta.dot}`} />
                          Priorité {pMeta.label}
                        </span>
                        <span className="text-[10px] font-mono text-gray-400">{tMeta.label}</span>
                      </div>
                      <p className="text-sm font-semibold text-gray-900 mb-0.5">IMEI …{ticket.device_imei.slice(-8)}</p>
                      <p className="text-xs text-gray-600 leading-relaxed mb-2">{ticket.description}</p>
                      {ticket.notes && (
                        <p className="text-xs text-blue-600 italic">{ticket.notes}</p>
                      )}
                      <div className="flex flex-wrap gap-3 text-xs text-gray-400 mt-2">
                        {ticket.scheduled_at && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" /> Planifié: {formatDate(ticket.scheduled_at)}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          Ouvert le {formatDate(ticket.created_at)}
                        </span>
                      </div>
                    </div>
                    {/* Status toggle actions */}
                    <div className="flex flex-col gap-1.5 flex-shrink-0">
                      {ticket.status === 'PENDING' && (
                        <form action={updateMaintenanceStatusAction}>
                          <input type="hidden" name="ticket_id" value={ticket.id} />
                          <input type="hidden" name="status" value="IN_PROGRESS" />
                          <button type="submit" className="text-[10px] font-semibold text-blue-600 hover:underline whitespace-nowrap">
                            → En cours
                          </button>
                        </form>
                      )}
                      {ticket.status === 'IN_PROGRESS' && (
                        <form action={updateMaintenanceStatusAction}>
                          <input type="hidden" name="ticket_id" value={ticket.id} />
                          <input type="hidden" name="status" value="DONE" />
                          <button type="submit" className="text-[10px] font-semibold text-emerald-600 hover:underline whitespace-nowrap">
                            ✓ Terminé
                          </button>
                        </form>
                      )}
                      <form action={updateMaintenanceStatusAction}>
                        <input type="hidden" name="ticket_id" value={ticket.id} />
                        <input type="hidden" name="status" value="CANCELLED" />
                        <button type="submit" className="text-[10px] text-gray-400 hover:underline whitespace-nowrap">
                          Annuler
                        </button>
                      </form>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Done / archived */}
      {done.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50">
            <h3 className="font-semibold text-gray-500 text-sm">Historique ({done.length})</h3>
          </div>
          <ul className="divide-y divide-gray-50">
            {done.map((ticket) => {
              const tMeta = TYPE_META[ticket.maintenance_type];
              const sMeta = STATUS_META[ticket.status];
              const TIcon = tMeta.icon;
              return (
                <li key={ticket.id} className="px-5 py-3 flex items-center gap-3 opacity-60">
                  <TIcon className={`w-4 h-4 ${tMeta.color} flex-shrink-0`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700 truncate">IMEI …{ticket.device_imei.slice(-8)} — {tMeta.label}</p>
                    <p className="text-xs text-gray-400">{ticket.description.slice(0, 60)}…</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className={`text-[10px] font-bold ${sMeta.color}`}>{sMeta.label}</span>
                    {ticket.completed_at && (
                      <p className="text-[10px] text-gray-400">{formatDate(ticket.completed_at)}</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {tickets.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 px-5 py-16 text-center">
          <CheckCircle2 className="w-10 h-10 text-emerald-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">Aucun ticket de maintenance</p>
        </div>
      )}

      {/* Maintenance schedule notice */}
      <div className="bg-blue-50 border border-blue-100 rounded-2xl px-5 py-4 flex items-start gap-3">
        <Wrench className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-blue-800">Programme de maintenance préventive</p>
          <p className="text-xs text-blue-700 mt-0.5 leading-relaxed">
            Chaque bracelet SIGEP-G3 fait l&apos;objet d&apos;une inspection mensuelle : vérification de la batterie,
            calibrage GPS, et mise à jour firmware. La maintenance préventive réduit les fausses alertes de 68%.
          </p>
        </div>
      </div>
    </div>
  );
}
