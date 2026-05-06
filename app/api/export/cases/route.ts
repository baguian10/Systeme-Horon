import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { canExportData } from '@/lib/auth/permissions';
import { fetchCases } from '@/lib/mock/helpers';

// GET /api/export/cases — returns CSV download (STRATEGIC+ only)
export async function GET(_req: NextRequest) {
  const session = await getSession();
  if (!session || !canExportData(session.role)) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  }

  const cases = await fetchCases(session.role, session.id);
  const date = new Date().toISOString().slice(0, 10);
  const showNames = session.role !== 'STRATEGIC';

  const header = [
    'N° Dossier', 'Statut', 'Date ordonnance', 'Début de mesure', 'Fin de mesure',
    'Juge', ...(showNames ? ['Individu', 'N° Identité'] : []),
    'Bracelet (IMEI)', 'Alertes actives',
  ].join(',');

  const rows = cases.map((c) => {
    const cols = [
      c.case_number,
      c.status,
      c.court_order_date,
      c.start_date?.slice(0, 10) ?? '',
      c.end_date?.slice(0, 10) ?? '',
      `"${c.judge?.full_name ?? ''}"`,
      ...(showNames ? [`"${c.individual?.full_name ?? ''}"`, c.individual?.national_id ?? ''] : []),
      c.device?.imei ?? '',
      String(c.alert_count ?? 0),
    ];
    return cols.join(',');
  });

  const csv = [header, ...rows].join('\n');

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="sigep-dossiers-${date}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
