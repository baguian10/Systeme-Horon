'use client';

import { useEffect, useRef } from 'react';
import type { Alert } from '@/lib/supabase/types';
import { IS_DEMO_MODE } from '@/lib/supabase/client';

type AlertListener = (alert: Alert) => void;

export function useAlertFeed(onNewAlert: AlertListener) {
  const callbackRef = useRef(onNewAlert);
  callbackRef.current = onNewAlert;

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

    import('@/lib/supabase/client').then(({ createClient }) => {
      const supabase = createClient();
      if (!supabase) return;

      supabase
        .channel('alerts-live')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'alerts' },
          (payload) => {
            callbackRef.current(payload.new as Alert);
          }
        )
        .subscribe();
    });
  }, []);
}
