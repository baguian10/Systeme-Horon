import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { fetchCases, fetchAlerts, fetchAgenda } from '@/lib/mock/helpers';
import { canViewCases } from '@/lib/auth/permissions';
import TerrainApp from './TerrainApp';

export const metadata = { title: 'Mode Terrain — SIGEP' };
export const dynamic = 'force-dynamic';

export default async function TerrainPage() {
  const session = await getSession();
  if (!session || !canViewCases(session.role)) redirect('/sigep/dashboard');

  const [cases, alerts, agenda] = await Promise.all([
    fetchCases(session.role, session.id),
    fetchAlerts(session.role),
    fetchAgenda(session.role, session.id),
  ]);

  const today = new Date().toISOString().slice(0, 10);

  const payload = {
    cases: cases
      .filter((c) => c.status === 'ACTIVE' || c.status === 'VIOLATION')
      .map((c) => ({
        id:              c.id,
        case_number:     c.case_number,
        status:          c.status,
        individual_name: c.individual?.full_name ?? '—',
        individual_address: c.individual?.address ?? '—',
        device_online:   c.device?.is_online ?? false,
        battery_pct:     c.device?.battery_pct ?? null,
        alert_count:     c.alert_count ?? 0,
        last_lat:        c.last_position?.latitude ?? null,
        last_lng:        c.last_position?.longitude ?? null,
      })),
    alerts: alerts
      .filter((a) => !a.is_resolved)
      .slice(0, 10)
      .map((a) => ({
        id:           a.id,
        case_id:      a.case_id,
        alert_type:   a.alert_type,
        severity:     a.severity,
        description:  a.description,
        triggered_at: a.triggered_at,
      })),
    agenda: agenda
      .filter((a) => a.scheduled_date >= today)
      .slice(0, 8)
      .map((a) => ({
        id:               a.id,
        case_number:      a.case_number,
        individual_name:  a.individual_name,
        obligation_type:  a.obligation_type,
        title:            a.title,
        scheduled_date:   a.scheduled_date,
        start_time:       a.start_time,
        location:         a.location,
        is_confirmed:     a.is_confirmed,
      })),
    user: {
      id:        session.id,
      full_name: session.full_name,
      role:      session.role,
      badge:     session.badge_number,
    },
    fetched_at: new Date().toISOString(),
  };

  return <TerrainApp initialData={payload} />;
}
