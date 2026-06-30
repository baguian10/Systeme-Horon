import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { analyzeDay, emptyDay } from '@/lib/track/day';

export const dynamic = 'force-dynamic';

async function getClient(role?: string) {
  if (role === 'SUPER_ADMIN') {
    const { createAdminClient } = await import('@/lib/supabase/admin');
    return createAdminClient();
  }
  const { createClient } = await import('@/lib/supabase/server');
  return createClient();
}

// GET /api/track/history
//   ?caseId=...                        → legacy trail [[lat,lng],...] (TrackingMap)
//   ?caseId=...&date=YYYY-MM-DD         → enriched daily itinerary
//   ?caseId=...&mode=days&month=YYYY-MM → list of days with data (calendar dots)
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ trail: [] }, { status: 401 });

  const sp = request.nextUrl.searchParams;
  const caseId = sp.get('caseId');
  if (!caseId) return NextResponse.json({ trail: [] }, { status: 400 });

  const date = sp.get('date');
  const mode = sp.get('mode');

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    if (mode === 'days') return NextResponse.json({ days: [] });
    if (date) return NextResponse.json({ ...emptyDay(date), trail: [] });
    return NextResponse.json({ trail: [] });
  }

  const supabase = await getClient(session.role);
  if (!supabase) return NextResponse.json({ trail: [] });

  // ---- calendar: which days in a month have positions ----
  if (mode === 'days') {
    const month = sp.get('month');
    if (!month) return NextResponse.json({ days: [] });
    const from = new Date(`${month}-01T00:00:00Z`);
    const to = new Date(from);
    to.setUTCMonth(to.getUTCMonth() + 1);
    const { data } = await supabase
      .from('positions')
      .select('recorded_at')
      .eq('case_id', caseId)
      .gte('recorded_at', from.toISOString())
      .lt('recorded_at', to.toISOString())
      .order('recorded_at', { ascending: true })
      .limit(50000);
    const set = new Set<string>();
    for (const r of data ?? []) set.add((r.recorded_at as string).slice(0, 10));
    return NextResponse.json({ days: [...set].sort() });
  }

  // ---- window of enriched points (incident replay): ?from=&to= ISO ----
  const fromParam = sp.get('from');
  const toParam = sp.get('to');
  if (!date && fromParam && toParam) {
    const { data } = await supabase
      .from('positions')
      .select('latitude, longitude, speed_kmh, recorded_at')
      .eq('case_id', caseId)
      .gte('recorded_at', fromParam)
      .lte('recorded_at', toParam)
      .order('recorded_at', { ascending: true })
      .limit(5000);
    const points = (data ?? []).map((p) => ({
      lat: p.latitude as number,
      lng: p.longitude as number,
      t: Date.parse(p.recorded_at as string),
      speed: (p.speed_kmh as number | null) ?? null,
    }));
    return NextResponse.json({ points });
  }

  // ---- legacy trail (no date) — keep TrackingMap working ----
  if (!date) {
    const limit = Math.min(Number(sp.get('limit') ?? 300), 1000);
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

  // ---- enriched daily itinerary ----
  const day = await analyzeDay(supabase, caseId, date, { geocode: sp.get('geocode') !== '0' });
  return NextResponse.json({ ...day, trail: day.points.map((p) => [p.lat, p.lng] as [number, number]) });
}
