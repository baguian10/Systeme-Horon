import { type NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { fetchCaseById } from '@/lib/mock/helpers';
import { canViewPII } from '@/lib/auth/permissions';
import { analyzeDay } from '@/lib/track/day';
import { buildReportHtml } from '@/lib/track/report-html';
import { htmlToPdf } from '@/lib/pdf/render';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // PDF render can take a few seconds

async function getClient(role?: string) {
  if (role === 'SUPER_ADMIN') {
    const { createAdminClient } = await import('@/lib/supabase/admin');
    return createAdminClient();
  }
  const { createClient } = await import('@/lib/supabase/server');
  return createClient();
}

// GET /api/track/history/report?caseId=...&date=YYYY-MM-DD  → application/pdf
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const sp = request.nextUrl.searchParams;
  const caseId = sp.get('caseId');
  const date = sp.get('date');
  if (!caseId || !date) return NextResponse.json({ error: 'caseId et date requis' }, { status: 400 });

  // RLS-scoped: fetchCaseById returns null if the user cannot read this case.
  const caseData = await fetchCaseById(caseId);
  if (!caseData) return NextResponse.json({ error: 'Dossier introuvable' }, { status: 404 });

  const supabase = await getClient(session.role);
  if (!supabase) return NextResponse.json({ error: 'Indisponible' }, { status: 503 });

  const day = await analyzeDay(supabase, caseId, date, { geocode: true });

  const showPII = canViewPII(session.role);
  const html = buildReportHtml(
    {
      personName: showPII ? caseData.individual?.full_name ?? '—' : 'Personne surveillée',
      caseNumber: caseData.case_number,
      measureType: caseData.measure_type ?? null,
      judgeName: caseData.judge?.full_name ?? null,
      generatedBy: session.full_name,
      date,
    },
    day,
  );

  try {
    const pdf = await htmlToPdf(html);
    return new NextResponse(pdf as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="itineraire_${caseData.case_number}_${date}.pdf"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur génération PDF' }, { status: 500 });
  }
}
