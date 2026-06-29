import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, User, Calendar, FileText, Wifi, WifiOff,
  Battery, MapPin, ShieldCheck, Clock,
} from 'lucide-react';
import { fetchCaseById, fetchCaseAssignments, fetchOperationalUsers, fetchJournalEntries } from '@/lib/mock/helpers';
import { getSession } from '@/lib/auth/session';
import { CaseStatusBadge, AlertTypeBadge, SeverityDot, RiskBadge } from '@/components/ui/StatusBadge';
import RiskControl from '@/components/cases/RiskControl';
import { canViewPII, canManageGeofences, canUpdateCaseStatus, canManageAssignments, canWriteJournal, canConfigureHardware, allow } from '@/lib/auth/permissions';
import StatusControls from '@/components/cases/StatusControls';
import GeofenceManager from '@/components/cases/GeofenceManager';
import MeasurePanel from '@/components/cases/MeasurePanel';
import CaseBeaconManager from '@/components/cases/CaseBeaconManager';
import CaseDeviceManager from '@/components/cases/CaseDeviceManager';
import CasePresencePanel from '@/components/cases/CasePresencePanel';
import DeviceConfigPanel from '@/components/cases/DeviceConfigPanel';
import CommsPanel from '@/components/cases/CommsPanel';
import AssignmentManager from '@/components/cases/AssignmentManager';
import JournalPanel from '@/components/cases/JournalPanel';

export default async function CaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [session, caseData, assignments, allOperationals, journalEntries] = await Promise.all([
    getSession(), fetchCaseById(id), fetchCaseAssignments(id), fetchOperationalUsers(), fetchJournalEntries(id),
  ]);
  if (!session || !caseData) notFound();

  const showPII = canViewPII(session.role);
  const canGeo = allow(session, canManageGeofences(session.role), 'geofences');
  const canDefineObligation = allow(session, false, 'geofences.define');
  const canStatus = canUpdateCaseStatus(session.role);
  const canAssign = canManageAssignments(session.role);
  const canJournal = canWriteJournal(session.role);
  const individual = caseData.individual;
  const device = caseData.device;
  const openAlerts = (caseData.alerts ?? []).filter((a) => !a.is_resolved);
  const geofences = caseData.geofences ?? [];

  // BLE beacon associated with this dossier's bracelet (+ spares to attach).
  type BeaconRow = { id: string; uid: string; label: string | null; status: string };
  const canHardware = allow(session, canConfigureHardware(session.role), 'hardware');
  const canBeacon = allow(session, canConfigureHardware(session.role), 'beacons');
  const canCommand = allow(session, canConfigureHardware(session.role), 'commands');
  const canShutdownCmd = allow(session, canConfigureHardware(session.role), 'commands.shutdown');
  let currentBeacon: BeaconRow | null = null;
  let spareBeacons: BeaconRow[] = [];
  let spareDevices: { id: string; imei: string }[] = [];
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    const { createAdminClient } = await import('@/lib/supabase/admin');
    const sb = createAdminClient();
    if (sb) {
      if (device?.id) {
        const { data: cur } = await sb.from('beacons').select('id, uid, label, status').eq('device_id', device.id).maybeSingle();
        currentBeacon = (cur as BeaconRow) ?? null;
      }
      const { data: sp } = await sb.from('beacons').select('id, uid, label, status').is('device_id', null).limit(50);
      spareBeacons = (sp as BeaconRow[]) ?? [];
      if (canHardware) {
        const { data: sd } = await sb.from('devices').select('id, imei').is('case_id', null).limit(100);
        spareDevices = (sd as { id: string; imei: string }[]) ?? [];
      }
    }
  }

  const assignedIds = new Set(assignments.map((a) => a.id));
  const availableOperationals = allOperationals.filter((u) => !assignedIds.has(u.id));

  function formatDate(iso: string | null) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  }
  function formatDateTime(iso: string) {
    return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  }
  function timeAgo(iso: string) {
    const d = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    return d < 60 ? `${d}min` : `${Math.floor(d / 60)}h`;
  }

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Back + Header */}
      <div>
        <Link
          href="/sigep/dashboard/cases"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Retour aux dossiers
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-xl font-bold text-gray-900 font-mono">{caseData.case_number}</h2>
              <CaseStatusBadge status={caseData.status} />
              {openAlerts.length > 0 && (
                <span className="bg-red-100 text-red-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                  {openAlerts.length} alerte{openAlerts.length > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-0.5">
              Ordonnance du {formatDate(caseData.court_order_date)} · Juge {caseData.judge?.full_name ?? '—'}
            </p>
          </div>
          {canStatus && caseData.status !== 'TERMINATED' && (
            <StatusControls caseId={caseData.id} currentStatus={caseData.status} />
          )}
          <div className="mt-3">
            {canStatus
              ? <RiskControl caseId={caseData.id} value={caseData.risk_level} />
              : <RiskBadge level={caseData.risk_level} />}
          </div>
          {caseData.department?.name && (
            <p className="mt-2 text-xs text-gray-500">Juridiction : <span className="font-medium text-gray-700">{caseData.department.name}</span></p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left column */}
        <div className="lg:col-span-1 space-y-4">
          {/* Individual */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Individu concerné</h3>
            {showPII && individual ? (
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-gray-400" />
                  <span className="font-semibold text-gray-900">{individual.full_name}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-500">
                  <Calendar className="w-4 h-4 text-gray-300" />
                  <span>Né(e) le {formatDate(individual.date_of_birth)}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-500">
                  <FileText className="w-4 h-4 text-gray-300" />
                  <span className="font-mono text-xs">{individual.national_id}</span>
                </div>
                {individual.address && (
                  <div className="flex items-start gap-2 text-gray-500">
                    <MapPin className="w-4 h-4 text-gray-300 mt-0.5 flex-shrink-0" />
                    <span>{individual.address}</span>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-400 italic">Identité masquée (accès restreint)</p>
            )}
          </div>

          {/* Device */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Bracelet de Sûreté</h3>
            {device ? (
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Statut</span>
                  <span className={`flex items-center gap-1.5 font-medium ${device.is_online ? 'text-green-600' : 'text-gray-400'}`}>
                    {device.is_online ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
                    {device.is_online ? 'En ligne' : 'Hors ligne'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Batterie</span>
                  <span className={`flex items-center gap-1 font-medium ${(device.battery_pct ?? 100) < 20 ? 'text-red-500' : 'text-gray-700'}`}>
                    <Battery className="w-3.5 h-3.5" />
                    {device.battery_pct ?? '—'}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">IMEI</span>
                  <span className="font-mono text-xs text-gray-600">{device.imei}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Firmware</span>
                  <span className="text-xs text-gray-600">{device.firmware_ver}</span>
                </div>
                {device.last_seen_at && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Dernier contact</span>
                    <span className="text-xs text-gray-400">{timeAgo(device.last_seen_at)} ago</span>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-400">Aucun bracelet assigné</p>
            )}
          </div>

          {/* Notes */}
          {caseData.notes && (
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Notes du juge</h3>
              <p className="text-sm text-gray-600 leading-relaxed">{caseData.notes}</p>
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="lg:col-span-2 space-y-4">
          {/* Last position */}
          <div className="bg-slate-900 rounded-2xl p-5">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Dernière position connue</h3>
            {caseData.last_position ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-mono text-lg text-white">
                    {caseData.last_position.latitude.toFixed(5)}, {caseData.last_position.longitude.toFixed(5)}
                  </p>
                  <div className="flex items-center gap-3 mt-1 text-slate-400 text-xs">
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {timeAgo(caseData.last_position.recorded_at)} ago</span>
                    {caseData.last_position.accuracy_m && (
                      <span>Précision ±{caseData.last_position.accuracy_m}m</span>
                    )}
                    {caseData.last_position.speed_kmh !== null && caseData.last_position.speed_kmh !== undefined && (
                      <span>{caseData.last_position.speed_kmh} km/h</span>
                    )}
                  </div>
                </div>
                <MapPin className="w-8 h-8 text-blue-400 opacity-60" />
              </div>
            ) : (
              <p className="text-sm text-slate-500">Aucune position disponible</p>
            )}
            <Link
              href={`/sigep/dashboard/cases/${id}/history`}
              className="mt-4 flex items-center justify-center gap-2 w-full bg-violet-600 hover:bg-violet-700 text-white rounded-xl py-2.5 text-sm font-semibold transition"
            >
              🛣️ Itinéraire & historique journalier
            </Link>
          </div>

          {/* Active Alerts */}
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-50">
              <h3 className="font-semibold text-gray-900">Alertes actives</h3>
            </div>
            {openAlerts.length === 0 ? (
              <div className="flex items-center gap-2 px-5 py-4 text-sm text-emerald-600">
                <ShieldCheck className="w-4 h-4" /> Aucune alerte en cours
              </div>
            ) : (
              <ul className="divide-y divide-gray-50">
                {openAlerts.map((alert) => (
                  <li key={alert.id} className="px-5 py-3 flex items-start gap-3">
                    <SeverityDot level={alert.severity} />
                    <div className="flex-1 min-w-0">
                      <AlertTypeBadge type={alert.alert_type} />
                      <p className="text-xs text-gray-500 mt-1">{alert.description}</p>
                    </div>
                    <span className="text-xs text-gray-400 whitespace-nowrap">{formatDateTime(alert.triggered_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Mesure judiciaire + aménagement */}
          <MeasurePanel
            caseId={caseData.id}
            measureType={caseData.measure_type}
            legalBasis={caseData.legal_basis}
            ordonnanceRef={caseData.ordonnance_ref}
            ordonnanceUrl={caseData.ordonnance_url}
            obligations={caseData.obligations}
            endDate={caseData.end_date}
            canAmend={canStatus}
            terminated={caseData.status === 'TERMINATED'}
          />

          {/* Geofences */}
          <GeofenceManager
            caseId={caseData.id}
            geofences={geofences}
            canManage={canGeo && caseData.status !== 'TERMINATED'}
            canDefine={canDefineObligation && caseData.status !== 'TERMINATED'}
            canValidate={canGeo && caseData.status !== 'TERMINATED'}
          />

          {/* GPS bracelet assignment (SUPER_ADMIN) */}
          {canHardware && (
            <CaseDeviceManager
              caseId={caseData.id}
              current={device ? { id: device.id, imei: device.imei } : null}
              spares={spareDevices}
              canManage={caseData.status !== 'TERMINATED'}
            />
          )}

          {/* BLE beacon */}
          <CaseBeaconManager
            caseId={caseData.id}
            hasDevice={!!device}
            current={currentBeacon}
            spares={spareBeacons}
            canManage={canBeacon && caseData.status !== 'TERMINATED'}
          />

          {/* Home presence + remote commands */}
          {device && (
            <CasePresencePanel imei={device.imei} canCommand={canCommand} canShutdown={canShutdownCmd} />
          )}

          {/* Voice communication (SOS numbers, white list, call) */}
          {device && (
            <CommsPanel
              deviceId={device.id}
              imei={device.imei}
              simNumber={device.sim_number ?? null}
              sosNumbers={device.sos_numbers ?? []}
              whitelist={device.call_whitelist ?? []}
              callEnabled={device.call_enabled ?? true}
              canEdit={canCommand}
            />
          )}

          {/* Device protocol config (SUPER_ADMIN / hardware) */}
          {device && canHardware && (
            <DeviceConfigPanel imei={device.imei} />
          )}

          {/* Assignments */}
          <AssignmentManager
            caseId={caseData.id}
            assigned={assignments.map((a) => ({ id: a.id, full_name: a.full_name, badge_number: a.badge_number, assigned_at: a.assigned_at }))}
            available={availableOperationals.map((u) => ({ id: u.id, full_name: u.full_name, badge_number: u.badge_number }))}
            canManage={canAssign && caseData.status !== 'TERMINATED'}
          />

          {/* Journal comportemental */}
          <JournalPanel
            caseId={caseData.id}
            entries={journalEntries}
            canWrite={canJournal && caseData.status !== 'TERMINATED'}
          />
        </div>
      </div>
    </div>
  );
}
