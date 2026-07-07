'use client';

import { useEffect, useRef, useState } from 'react';
import { IS_DEMO_MODE } from '@/lib/supabase/client';

// Client side of /api/realtime/stream (SSE). One multiplexed, authenticated
// feed for the operations center: positions, alerts (new + state changes) and
// device events, < 3 s end-to-end. EventSource auto-reconnects and resends
// Last-Event-ID, so a dropped connection resumes without losing events.

export interface StreamPosition {
  case_id: string;
  device_id: string;
  latitude: number;
  longitude: number;
  speed_kmh: number | null;
  recorded_at: string;
  case_number: string | null;
  status: string | null;
}

export interface StreamAlert {
  id: string;
  case_id: string;
  alert_type: string;
  severity: number;
  description: string | null;
  is_resolved: boolean;
  triggered_at: string;
  status?: string | null;
  assigned_to?: string | null;
  acknowledged_at?: string | null;
  resolved_at?: string | null;
  condition_cleared_at?: string | null;
  escalated_at?: string | null;
  escalated_l2_at?: string | null;
  case_number: string | null;
}

export interface StreamDeviceEvent {
  id: string;
  event_type: string;
  detail: string | null;
  created_at: string;
  case_id: string | null;
  case_number: string | null;
}

export interface StreamOperator {
  user_id: string;
  full_name: string;
  role: string;
}

interface Handlers {
  onPosition?: (p: StreamPosition) => void;
  onAlert?: (a: StreamAlert) => void;
  onAlertUpdate?: (a: StreamAlert) => void;
  onEvent?: (e: StreamDeviceEvent) => void;
  onPresence?: (ops: StreamOperator[]) => void;
}

export function useRealtimeStream(handlers: Handlers): { connected: boolean } {
  const [connected, setConnected] = useState(false);
  const h = useRef(handlers);
  useEffect(() => { h.current = handlers; });

  useEffect(() => {
    // Demo mode: the simulator engine drives the console — no SSE.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (IS_DEMO_MODE) { setConnected(true); return; }

    const es = new EventSource('/api/realtime/stream');

    es.onopen = () => setConnected(true);
    // EventSource retries automatically (server sets retry: 2000) and resends
    // Last-Event-ID — just reflect the connection state.
    es.onerror = () => setConnected(false);

    const on = <T,>(name: string, cb: ((v: T) => void) | undefined) => {
      es.addEventListener(name, (e) => {
        if (!cb) return;
        try { cb(JSON.parse((e as MessageEvent).data) as T); } catch { /* malformed frame */ }
      });
    };
    on<StreamPosition>('position', (p) => h.current.onPosition?.(p));
    on<StreamAlert>('alert', (a) => h.current.onAlert?.(a));
    on<StreamAlert>('alert_update', (a) => h.current.onAlertUpdate?.(a));
    on<StreamDeviceEvent>('device_event', (e) => h.current.onEvent?.(e));
    on<StreamOperator[]>('presence', (ops) => h.current.onPresence?.(ops));

    return () => { es.close(); };
  }, []);

  return { connected };
}
