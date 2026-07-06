import { type NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { canViewCases, canViewDevices, canResolveAlert, allow } from '@/lib/auth/permissions';
import { toCsv, csvResponse } from '@/lib/export/csv';

export const dynamic = 'force-dynamic';

async function getClient(role?: string) {
  if (role === 'SUPER_ADMIN') {
    const { createAdminClient } = await import('@/lib/supabase/admin');
    return createAdminClient();
  }
  const { createClient } = await import('@/lib/supabase/server');
  return createClient();
}

function fmt(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString('fr-FR', { timeZone: 'UTC' }) : '';
}

// GET /api/export/{alerts|devices|positions}[?caseId&from&to]  → text/csv
export async function GET(request: NextRequest, ctx: { params: Promise<{ type: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  const { type } = await ctx.params;
  const sp = request.nextUrl.searchParams;

  const supabase = await getClient(session.role);
  if (!supabase) return NextResponse.json({ error: 'Indisponible' }, { status: 503 });

  const today = new Date().toISOString().slice(0, 10);

  if (type === 'alerts') {
    if (!allow(session, canResolveAlert(session.role), 'alerts')) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    const { data } = await supabase
      .from('alerts')
      .select('alert_type, severity, status, description, is_resolved, resolution_category, resolution_reason, triggered_at, resolved_at, case:cases(case_number)')
      .order('triggered_at', { ascending: false })
      .limit(10000);
    const rows = (data ?? []).map((a) => [
      (a as { case?: { case_number?: string } }).case?.case_number ?? '',
      a.alert_type, a.severity, a.status ?? '', a.description ?? '',
      a.is_resolved ? 'oui' : 'non', a.resolution_category ?? '', a.resolution_reason ?? '',
      fmt(a.triggered_at as string), fmt(a.resolved_at as string | null),
    ]);
    return csvResponse(`alertes_${today}.csv`, toCsv(
      ['Dossier', 'Type', 'Gravité', 'Statut', 'Description', 'Résolue', 'Motif', 'Compte rendu', 'Déclenchée', 'Clôturée'], rows));
  }

  if (type === 'devices') {
    if (!allow(session, canViewDevices(session.role), 'hardware')) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    // select('*') keeps the export robust whether or not the lifecycle columns
    // are present; the case number is joined separately.
    const { data } = await supabase
      .from('devices')
      .select('*, case:cases(case_number)')
      .order('imei', { ascending: true })
      .limit(10000);
    const LIFECYCLE: Record<string, string> = { STOCK: 'En stock', ACTIVE: 'En service', MAINTENANCE: 'Maintenance', RETIRED: 'Réformé' };
    const rows: (string | number | null)[][] = (data ?? []).map((raw) => {
      const d = raw as Record<string, unknown> & { case?: { case_number?: string } };
      const life = (d.lifecycle_status as string | null) ?? (d.case_id ? 'ACTIVE' : 'STOCK');
      const worn = d.worn === true ? 'porté' : d.worn === false ? 'retiré' : 'inconnu';
      return [
        String(d.imei ?? ''), (d.model as string | null) ?? '', d.is_online ? 'en ligne' : 'hors ligne',
        LIFECYCLE[life] ?? life,
        (d.battery_pct as number | null) ?? '', (d.signal_strength_dbm as number | null) ?? '', worn,
        (d.sim_number as string | null) ?? '', (d.sim_carrier as string | null) ?? '', (d.sim_status as string | null) ?? '',
        fmt(d.last_seen_at as string | null), d.case?.case_number ?? '',
        fmt((d.retired_at as string | null) ?? null), (d.retired_reason as string | null) ?? '',
      ];
    });
    return csvResponse(`bracelets_${today}.csv`, toCsv(
      ['IMEI', 'Modèle', 'État', 'Cycle de vie', 'Batterie %', 'Signal dBm', 'Port', 'SIM', 'Opérateur', 'SIM statut', 'Dernier contact', 'Dossier', 'Réformé le', 'Motif réforme'], rows));
  }

  if (type === 'positions') {
    if (!allow(session, canViewCases(session.role), 'cases.viewAll')) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    const caseId = sp.get('caseId');
    if (!caseId) return NextResponse.json({ error: 'caseId requis' }, { status: 400 });
    let q = supabase.from('positions').select('latitude, longitude, speed_kmh, accuracy_m, recorded_at').eq('case_id', caseId);
    const from = sp.get('from'); const to = sp.get('to');
    if (from) q = q.gte('recorded_at', from);
    if (to) q = q.lte('recorded_at', to);
    const { data } = await q.order('recorded_at', { ascending: true }).limit(50000);
    const rows = (data ?? []).map((p) => [
      fmt(p.recorded_at as string), p.latitude, p.longitude, p.speed_kmh ?? '', p.accuracy_m ?? '',
    ]);
    return csvResponse(`positions_${caseId.slice(0, 8)}_${today}.csv`, toCsv(
      ['Horodatage', 'Latitude', 'Longitude', 'Vitesse km/h', 'Précision m'], rows));
  }

  return NextResponse.json({ error: 'Type inconnu' }, { status: 404 });
}
