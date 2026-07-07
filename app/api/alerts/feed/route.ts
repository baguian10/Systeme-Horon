import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

// GET /api/alerts/feed?since=<ISO>
// Session-authenticated polling feed for the live alert toasts. Exists because
// Supabase Realtime postgres_changes is RLS-gated and this platform uses its
// own session auth (anon key carries no user) — the realtime channel stays
// silent in production. Polling through this route keeps toast + siren working
// without opening the alerts table to anonymous reads.
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ alerts: [] }, { status: 401 });

  const isDemoMode = !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (isDemoMode) return NextResponse.json({ alerts: [] });

  const since = request.nextUrl.searchParams.get('since');
  const sinceIso = since && !Number.isNaN(Date.parse(since))
    ? since
    : new Date(Date.now() - 60_000).toISOString();

  const { createAdminClient } = await import('@/lib/supabase/admin');
  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json({ alerts: [] }, { status: 503 });

  const { data } = await supabase
    .from('alerts')
    .select('*, case:cases(case_number)')
    .gt('triggered_at', sinceIso)
    .order('triggered_at', { ascending: true })
    .limit(20);

  return NextResponse.json({ alerts: data ?? [], now: new Date().toISOString() });
}
