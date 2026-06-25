import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

// GET /api/track/history?caseId=...&limit=300
// Returns the recent GPS trail for a case (chronological), RLS-scoped.
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ trail: [] }, { status: 401 });

  const caseId = request.nextUrl.searchParams.get('caseId');
  const limit = Math.min(Number(request.nextUrl.searchParams.get('limit') ?? 300), 1000);
  if (!caseId) return NextResponse.json({ trail: [] }, { status: 400 });

  // Demo mode — no Supabase: return empty (live overlay has no history).
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return NextResponse.json({ trail: [] });
  }

  const { createClient } = await import('@/lib/supabase/server');
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ trail: [] });

  const { data } = await supabase
    .from('positions')
    .select('latitude, longitude, recorded_at')
    .eq('case_id', caseId)
    .order('recorded_at', { ascending: false })
    .limit(limit);

  const trail = (data ?? [])
    .reverse()
    .map((p) => [p.latitude, p.longitude] as [number, number]);

  return NextResponse.json({ trail });
}
