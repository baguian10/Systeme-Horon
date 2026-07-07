import type { NextRequest } from 'next/server';
import { getSession } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// GET /api/realtime/stream — authenticated Server-Sent Events feed for the
// operations center. Supabase Realtime postgres_changes is RLS-gated and this
// platform authenticates with its own session (the anon key carries no user),
// so browser-side channels stay silent in production. This route polls the DB
// server-side (service role) every TICK_MS and pushes typed events:
//   position · alert · alert_update · device_event   (+ ": ping" heartbeats)
// Reconnection: EventSource resends Last-Event-ID (our cursor timestamp) so a
// dropped connection resumes where it left off — no missed events.
const TICK_MS = 2_500;
const LIFETIME_MS = 280_000; // close before Vercel's maxDuration; client auto-reconnects

function sse(id: string | null, event: string, data: unknown): string {
  return `${id ? `id: ${id}\n` : ''}event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role === 'STRATEGIC') {
    return new Response('Unauthorized', { status: 401 });
  }

  const isDemoMode = !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (isDemoMode) return new Response('Demo mode', { status: 501 });

  const { createAdminClient } = await import('@/lib/supabase/admin');
  const supabase = createAdminClient();
  if (!supabase) return new Response('DB unavailable', { status: 503 });

  // Resume point: Last-Event-ID (auto-sent on reconnect) > ?since= > now-60s.
  const lastId = request.headers.get('last-event-id') ?? request.nextUrl.searchParams.get('since');
  const since = lastId && !Number.isNaN(Date.parse(lastId))
    ? lastId
    : new Date(Date.now() - 60_000).toISOString();

  let posCur = since;
  let alertCur = since;
  let updCur = since;
  let evtCur = since;
  let tickCount = 0;

  // Presence: register this operator immediately; refreshed every 4th tick
  // (~10 s). Rows expire by TTL (90 s) — no explicit delete, so several tabs
  // or a dirty disconnect never desynchronize the roster.
  const touchPresence = () =>
    supabase.from('op_presence').upsert({
      user_id: session.id, full_name: session.full_name, role: session.role,
      last_seen_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
  await touchPresence();

  const encoder = new TextEncoder();
  const startedAt = Date.now();
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (chunk: string) => {
        if (closed) return;
        try { controller.enqueue(encoder.encode(chunk)); } catch { closed = true; }
      };
      const close = () => {
        if (closed) return;
        closed = true;
        try { controller.close(); } catch { /* already closed */ }
      };
      request.signal.addEventListener('abort', close);

      send('retry: 2000\n\n');

      while (!closed && Date.now() - startedAt < LIFETIME_MS) {
        const tickIso = new Date().toISOString();
        try {
          const [posQ, alertQ, updQ, evtQ] = await Promise.all([
            supabase.from('positions')
              .select('case_id, device_id, latitude, longitude, speed_kmh, recorded_at, case:cases(case_number, status)')
              .gt('recorded_at', posCur)
              .order('recorded_at', { ascending: true })
              .limit(200),
            supabase.from('alerts')
              .select('id, case_id, device_id, alert_type, severity, description, position_lat, position_lon, is_resolved, triggered_at, status, assigned_to, acknowledged_at, resolved_at, condition_cleared_at, escalated_at, escalated_l2_at, case:cases(case_number)')
              .gt('triggered_at', alertCur)
              .order('triggered_at', { ascending: true })
              .limit(50),
            supabase.from('alerts')
              .select('id, case_id, alert_type, severity, description, is_resolved, triggered_at, status, assigned_to, acknowledged_at, resolved_at, condition_cleared_at, escalated_at, escalated_l2_at, case:cases(case_number)')
              .or(`acknowledged_at.gt.${updCur},resolved_at.gt.${updCur},condition_cleared_at.gt.${updCur},escalated_at.gt.${updCur},escalated_l2_at.gt.${updCur}`)
              .limit(50),
            supabase.from('device_events')
              .select('id, event_type, detail, created_at, case_id, case:cases(case_number)')
              .gt('created_at', evtCur)
              .order('created_at', { ascending: true })
              .limit(100),
          ]);

          type CaseJoin = { case_number?: string; status?: string } | null;

          for (const p of (posQ.data ?? []) as Array<{ case_id: string; device_id: string; latitude: number; longitude: number; speed_kmh: number | null; recorded_at: string; case?: CaseJoin }>) {
            send(sse(p.recorded_at, 'position', {
              case_id: p.case_id, device_id: p.device_id,
              latitude: p.latitude, longitude: p.longitude,
              speed_kmh: p.speed_kmh, recorded_at: p.recorded_at,
              case_number: p.case?.case_number ?? null,
              status: p.case?.status ?? null,
            }));
            posCur = p.recorded_at;
          }

          for (const a of (alertQ.data ?? []) as Array<Record<string, unknown> & { triggered_at: string; case?: CaseJoin }>) {
            send(sse(a.triggered_at, 'alert', { ...a, case_number: a.case?.case_number ?? null }));
            alertCur = a.triggered_at;
          }

          for (const a of (updQ.data ?? []) as Array<Record<string, unknown> & { case?: CaseJoin }>) {
            send(sse(null, 'alert_update', { ...a, case_number: a.case?.case_number ?? null }));
          }
          updCur = tickIso;

          for (const e of (evtQ.data ?? []) as Array<{ id: string; event_type: string; detail: string | null; created_at: string; case_id: string | null; case?: CaseJoin }>) {
            send(sse(e.created_at, 'device_event', {
              id: e.id, event_type: e.event_type, detail: e.detail,
              created_at: e.created_at, case_id: e.case_id,
              case_number: e.case?.case_number ?? null,
            }));
            evtCur = e.created_at;
          }

          // Presence heartbeat + roster broadcast (~every 10 s).
          if (tickCount % 4 === 0) {
            await touchPresence();
            const { data: present } = await supabase
              .from('op_presence')
              .select('user_id, full_name, role')
              .gt('last_seen_at', new Date(Date.now() - 90_000).toISOString())
              .order('full_name', { ascending: true })
              .limit(50);
            send(sse(null, 'presence', present ?? []));
          }

          send(`: ping ${tickIso}\n\n`);
        } catch {
          // Transient DB error — keep the stream alive, next tick retries.
          send(': tick-error\n\n');
        }
        tickCount++;
        await new Promise((r) => setTimeout(r, TICK_MS));
      }

      // Graceful end-of-life: the browser reconnects with Last-Event-ID.
      close();
    },
    cancel() { closed = true; },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
