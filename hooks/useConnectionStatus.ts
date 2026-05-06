'use client';

import { useEffect, useState } from 'react';
import { IS_DEMO_MODE } from '@/lib/supabase/client';

export type ConnectionState = 'connecting' | 'live' | 'demo' | 'error';

export function useConnectionStatus(): ConnectionState {
  const [state, setState] = useState<ConnectionState>(IS_DEMO_MODE ? 'demo' : 'connecting');

  useEffect(() => {
    if (IS_DEMO_MODE) {
      // Check the simulator is running
      import('@/lib/simulator/engine').then(({ getSimulatorEngine }) => {
        const engine = getSimulatorEngine();
        if (!engine.isRunning()) engine.start();
        setState('demo');
      });
      return;
    }

    import('@/lib/supabase/client').then(({ createClient }) => {
      const supabase = createClient();
      if (!supabase) { setState('error'); return; }

      const channel = supabase
        .channel('connection-probe')
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') setState('live');
          else if (status === 'CHANNEL_ERROR') setState('error');
          else setState('connecting');
        });

      return () => channel.unsubscribe();
    });
  }, []);

  return state;
}
