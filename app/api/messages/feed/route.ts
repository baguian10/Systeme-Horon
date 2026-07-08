import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

// GET /api/messages/feed?threadId=&since=<ISO>
// Poll feed for the open conversation: new messages + thread meta (closed state,
// participants). Membership-gated — non-participants get 403.
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const isDemoMode = !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const threadId = request.nextUrl.searchParams.get('threadId');
  const since = request.nextUrl.searchParams.get('since');
  if (!threadId) return NextResponse.json({ error: 'threadId requis' }, { status: 400 });
  const sinceIso = since && !Number.isNaN(Date.parse(since)) ? since : new Date(0).toISOString();

  if (isDemoMode) {
    const { MOCK_MESSAGES, MOCK_THREADS } = await import('@/lib/mock/data');
    const t = MOCK_THREADS.find((x) => x.id === threadId);
    if (!t || !t.participant_ids.includes(session.id)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    const messages = MOCK_MESSAGES
      .filter((m) => m.thread_id === threadId && m.created_at > sinceIso)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
    return NextResponse.json({ messages, closed_at: null, participant_count: t.participant_ids.length, now: new Date().toISOString() });
  }

  const { createAdminClient } = await import('@/lib/supabase/admin');
  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json({ error: 'Indisponible' }, { status: 503 });

  const { data: t } = await supabase.from('message_threads')
    .select('participant_ids, closed_at').eq('id', threadId).maybeSingle();
  if (!t) return NextResponse.json({ error: 'Fil introuvable' }, { status: 404 });
  const participants = (t.participant_ids as string[] | null) ?? [];
  if (!participants.includes(session.id)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });

  const { data: rows } = await supabase.from('messages')
    .select('*, sender:users!sender_id(full_name, role)')
    .eq('thread_id', threadId)
    .gt('created_at', sinceIso)
    .order('created_at', { ascending: true })
    .limit(100);

  type Row = { id: string; thread_id: string; sender_id: string; content: string; is_read_by: string[] | null; created_at: string; sender?: { full_name?: string; role?: string } | null; sender_name?: string | null };
  const messages = ((rows ?? []) as Row[]).map((m) => ({
    id: m.id, thread_id: m.thread_id, sender_id: m.sender_id,
    sender_name: m.sender?.full_name ?? m.sender_name ?? 'Compte supprimé',
    sender_role: m.sender?.role ?? 'OPERATIONAL',
    content: m.content, is_read_by: m.is_read_by ?? [], created_at: m.created_at,
  }));

  return NextResponse.json({
    messages,
    closed_at: (t as { closed_at?: string | null }).closed_at ?? null,
    participant_count: participants.length,
    now: new Date().toISOString(),
  });
}
