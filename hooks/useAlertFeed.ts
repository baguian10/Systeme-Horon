'use client';

import { useEffect, useRef } from 'react';
import type { Alert } from '@/lib/supabase/types';
import { IS_DEMO_MODE } from '@/lib/supabase/client';

type AlertListener = (alert: Alert) => void;

export function useAlertFeed(onNewAlert: AlertListener) {
  const callbackRef = useRef(onNewAlert);
  useEffect(() => {
    callbackRef.current = onNewAlert;
  });

  useEffect(() => {
    if (IS_DEMO_MODE) {
      import('@/lib/simulator/engine').then(({ getSimulatorEngine }) => {
        const engine = getSimulatorEngine();
        const unsub = engine.subscribe((event) => {
          if (event.type === 'alert') {
            callbackRef.current(event.payload as Alert);
          }
        });
        if (!engine.isRunning()) engine.start();
        return unsub;
      });
      return;
    }

    let cleanup: (() => void) | undefined;

    // Seen-id guard so realtime + polling never double-fire the same alert.
    const seen = new Set<string>();
    const markSeen = (id: string) => {
      seen.add(id);
      if (seen.size > 300) { // cap memory
        const first = seen.values().next().value;
        if (first) seen.delete(first);
      }
    };
    const emit = (alert: Alert) => {
      if (!alert?.id || seen.has(alert.id)) return;
      markSeen(alert.id);
      callbackRef.current(alert);
    };

    import('@/lib/supabase/client').then(({ createClient }) => {
      const supabase = createClient();
      if (!supabase) return;

      // StrictMode re-mounts the effect; drop any stale channel of the same
      // name before subscribing, otherwise .on() is called on an already
      // subscribed channel ("cannot add postgres_changes callbacks ... after subscribe()").
      const stale = supabase.getChannels().find((c) => c.topic === 'realtime:alerts-live');
      if (stale) supabase.removeChannel(stale);

      const channel = supabase
        .channel('alerts-live')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'alerts' },
          (payload) => {
            emit(payload.new as Alert);
          }
        )
        .subscribe();

      cleanup = () => { supabase.removeChannel(channel); };
    });

    // Polling fallback — realtime postgres_changes is RLS-gated and this app
    // authenticates with its own session (anon key carries no user), so the
    // channel can stay silent in production. Poll the authenticated feed
    // every 20 s; the seen-set dedupes against realtime deliveries.
    let since = new Date().toISOString();
    const POLL_MS = 20_000;
    const timer = setInterval(async () => {
      if (document.visibilityState === 'hidden') return; // don't poll in background tabs
      try {
        const res = await fetch(`/api/alerts/feed?since=${encodeURIComponent(since)}`, { cache: 'no-store' });
        if (!res.ok) return;
        const body = await res.json() as { alerts: Alert[]; now?: string };
        for (const a of body.alerts ?? []) emit(a);
        if (body.now) since = body.now;
        else if (body.alerts?.length) since = body.alerts[body.alerts.length - 1].triggered_at;
      } catch { /* transient network error — next tick retries */ }
    }, POLL_MS);

    return () => { cleanup?.(); clearInterval(timer); };
  }, []);
}
