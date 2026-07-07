import { NextResponse, type NextRequest } from 'next/server';
import type { AlertType } from '@/lib/supabase/types';

// POST /api/ingest/alert
// Called by the certified secure device for tamper/health/panic events
// Body: { imei, type: AlertType, severity?, description?, lat?, lon? }
export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key');
  if (apiKey !== process.env.INGEST_API_KEY && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: {
    imei: string;
    type: AlertType;
    severity?: number;
    description?: string;
    lat?: number;
    lon?: number;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { imei, type, severity, description, lat, lon } = body;
  if (!imei || !type) {
    return NextResponse.json({ error: 'Missing required fields: imei, type' }, { status: 400 });
  }
  // SIGNAL_LOST disabled — generates too many false positives (GSM gaps, polling gaps).
  // Device offline status is visible on the bracelet panel and monitoring grid.
  if (type === 'SIGNAL_LOST') {
    return NextResponse.json({ ok: true, skipped: 'SIGNAL_LOST disabled' });
  }

  const isDemoMode = !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (isDemoMode) return NextResponse.json({ ok: true, demo: true });

  const { createAdminClient } = await import('@/lib/supabase/admin');
  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json({ error: 'DB unavailable' }, { status: 503 });

  const { data: device } = await supabase
    .from('devices')
    .select('id, case_id')
    .eq('imei', imei)
    .single();

  if (!device?.case_id) {
    return NextResponse.json({ error: 'Device not assigned to a case' }, { status: 404 });
  }

  const DEFAULT_SEVERITY: Partial<Record<AlertType, number>> = {
    TAMPER_DETECTED: 5, PANIC_BUTTON: 5, GEOFENCE_EXIT: 4, BLE_EXIT: 4,
    HEALTH_CRITICAL: 3, SIGNAL_LOST: 3, BATTERY_LOW: 2,
  };

  // Connectivity/battery signals are re-evaluated on every poll (~1 min) while
  // the condition persists, which without a guard produced one alert per minute.
  //
  // SIGNAL_LOST: keep a single OPEN alert per case until it is resolved — a lost
  //   link is one incident, not a stream.
  // BATTERY_LOW: the operator wants a recurring reminder while the battery stays
  //   low, but not every minute. Throttle to at most one every 10 minutes
  //   (regardless of resolution) so it nags at a usable cadence.
  const BATTERY_ALERT_INTERVAL_MIN = 10;
  if (type === 'SIGNAL_LOST') {
    const { count } = await supabase
      .from('alerts')
      .select('id', { count: 'exact', head: true })
      .eq('case_id', device.case_id)
      .eq('alert_type', 'SIGNAL_LOST')
      .eq('is_resolved', false);
    if (count && count > 0) {
      return NextResponse.json({ ok: true, deduped: true });
    }
  } else if (type === 'BATTERY_LOW') {
    const cutoff = new Date(Date.now() - BATTERY_ALERT_INTERVAL_MIN * 60_000).toISOString();
    const { count } = await supabase
      .from('alerts')
      .select('id', { count: 'exact', head: true })
      .eq('case_id', device.case_id)
      .eq('alert_type', 'BATTERY_LOW')
      .gte('triggered_at', cutoff);
    if (count && count > 0) {
      return NextResponse.json({ ok: true, throttled: true });
    }
  }

  const { data: alert } = await supabase
    .from('alerts')
    .insert({
      case_id: device.case_id,
      device_id: device.id,
      alert_type: type,
      severity: severity ?? DEFAULT_SEVERITY[type] ?? 3,
      description: description ?? null,
      position_lat: lat ?? null,
      position_lon: lon ?? null,
    })
    .select('id')
    .single();

  // For TAMPER or PANIC — immediately update case to VIOLATION status
  if (type === 'TAMPER_DETECTED' || type === 'PANIC_BUTTON') {
    await supabase
      .from('cases')
      .update({ status: 'VIOLATION', updated_at: new Date().toISOString() })
      .eq('id', device.case_id);
  }

  // Notify the case's judge + assigned agents per their preferences (best-effort).
  const { dispatchAlertNotifications } = await import('@/lib/notify');
  await dispatchAlertNotifications({ caseId: device.case_id, alertType: type, description });

  return NextResponse.json({ ok: true, alert_id: alert?.id });
}
