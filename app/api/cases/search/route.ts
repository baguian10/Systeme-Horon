import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

type Row = { id: string; case_number: string; individuals?: { full_name: string } | { full_name: string }[] | null };

// GET /api/cases/search?q=...  — search cases by case number or person name.
// RLS-scoped (a JUDGE only sees their own cases). Designed for 1000+ records.
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ cases: [] }, { status: 401 });

  const q = request.nextUrl.searchParams.get('q')?.trim();
  if (!q) return NextResponse.json({ cases: [] });

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return NextResponse.json({ cases: [] });

  const { createClient } = await import('@/lib/supabase/server');
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ cases: [] });

  const like = `%${q}%`;
  const [byNumber, byName] = await Promise.all([
    supabase.from('cases').select('id, case_number, individuals(full_name)').ilike('case_number', like).limit(15),
    supabase.from('cases').select('id, case_number, individuals!inner(full_name)').ilike('individuals.full_name', like).limit(15),
  ]);

  const seen = new Set<string>();
  const cases: { id: string; caseNumber: string; name: string }[] = [];
  const rows = [...(byNumber.data ?? []), ...(byName.data ?? [])] as unknown as Row[];
  for (const row of rows) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    const ind = Array.isArray(row.individuals) ? row.individuals[0] : row.individuals;
    cases.push({ id: row.id, caseNumber: row.case_number, name: ind?.full_name ?? '—' });
  }

  return NextResponse.json({ cases: cases.slice(0, 20) });
}
