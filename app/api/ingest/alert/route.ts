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

  const isDemoMode = !process.env.NEXT_PUBLIC_SUPABASE_URL;
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
    TAMPER_DETECTED: 5, PANIC_BUTTON: 5, GEOFENCE_EXIT: 4,
    HEALTH_CRITICAL: 3, SIGNAL_LOST: 3, BATTERY_LOW: 2,
  };

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

  return NextResponse.json({ ok: true, alert_id: alert?.id });
}
