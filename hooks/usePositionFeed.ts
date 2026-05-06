'use client';

import { useEffect, useState, useRef } from 'react';
import type { CaseStatus } from '@/lib/supabase/types';
import { IS_DEMO_MODE } from '@/lib/supabase/client';

export interface LivePosition {
  case_id: string;
  device_id: string;
  case_number: string;
  status: CaseStatus;
  alert_count: number;
  latitude: number;
  longitude: number;
  speed_kmh: number | null;
  recorded_at: string;
}

export function usePositionFeed(initialPositions: LivePosition[] = []) {
  const [positions, setPositions] = useState<Map<string, LivePosition>>(
    new Map(initialPositions.map((p) => [p.case_id, p]))
  );
  const channelRef = useRef<ReturnType<Awaited<ReturnType<typeof import('@supabase/ssr')['createBrowserClient']>>['channel']> | null>(null);

  useEffect(() => {
    if (IS_DEMO_MODE) {
      // Demo: subscribe to the simulator engine
      import('@/lib/simulator/engine').then(({ getSimulatorEngine }) => {
        const engine = getSimulatorEngine();
        const unsub = engine.subscribe((event) => {
          if (event.type === 'position') {
            const pos = event.payload as import('@/lib/simulator/engine').SimulatedPosition;
            setPositions((prev) => {
              const next = new Map(prev);
              next.set(pos.case_id, {
                case_id: pos.case_id,
                device_id: pos.device_id,
                case_number: pos.case_number,
                status: pos.status,
                alert_count: pos.alert_count,
                latitude: pos.latitude,
                longitude: pos.longitude,
                speed_kmh: pos.speed_kmh,
                recorded_at: pos.recorded_at,
              });
              return next;
            });
          }
        });

        if (!engine.isRunning()) engine.start();
        return unsub;
      });
      return;
    }

    // Real Supabase Realtime
    import('@/lib/supabase/client').then(({ createClient }) => {
      const supabase = createClient();
      if (!supabase) return;

      const channel = supabase
        .channel('positions-live')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'positions' },
          (payload) => {
            const row = payload.new as {
              case_id: string; device_id: string; latitude: number;
              longitude: number; speed_kmh: number; recorded_at: string;
            };
            setPositions((prev) => {
              const next = new Map(prev);
              const existing = prev.get(row.case_id);
              next.set(row.case_id, {
                ...(existing ?? {
                  case_number: row.case_id.slice(0, 8),
                  status: 'ACTIVE' as CaseStatus,
                  alert_count: 0,
                }),
                case_id: row.case_id,
                device_id: row.device_id,
                latitude: row.latitude,
                longitude: row.longitude,
                speed_kmh: row.speed_kmh,
                recorded_at: row.recorded_at,
              });
              return next;
            });
          }
        )
        .subscribe();

      channelRef.current = channel as never;
    });

    return () => {
      channelRef.current?.unsubscribe?.();
    };
  }, []);

  return Array.from(positions.values());
}
