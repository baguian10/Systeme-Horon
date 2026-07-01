import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { canConfigureHardware, allow } from '@/lib/auth/permissions';
import { isTraxbeanConfigured, configureDevice, sendDeviceCommand, setWearingDetection } from '@/lib/traxbean/client';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// POST /api/devices/provision  { imei, apn? }
// Unified hardware activation kit for a new/reassigned bracelet: applies the
// baseline config in one shot — Burkina timezone, carrier APN, BLE scan on,
// removal detection on. Each step reports its real result; nothing decorative.
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || !allow(session, canConfigureHardware(session.role), 'hardware')) {
    return NextResponse.json({ error: 'Accès refusé (SUPER_ADMIN requis)' }, { status: 403 });
  }
  if (!isTraxbeanConfigured()) {
    return NextResponse.json({ error: 'Plateforme GPS non configurée (TRAXBEAN_TOKEN).' }, { status: 503 });
  }
  let body: { imei?: string; apn?: 'orange' | 'moov' };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'JSON invalide' }, { status: 400 }); }
  const imei = body.imei?.trim();
  if (!imei) return NextResponse.json({ error: 'imei manquant' }, { status: 400 });
  const apn = body.apn === 'moov' ? 'moov' : 'orange';

  const steps: { step: string; ok: boolean }[] = [];
  steps.push({ step: 'Fuseau horaire (Burkina)', ok: await configureDevice(imei, 'timezoneBF') });
  steps.push({ step: `APN (${apn === 'moov' ? 'Moov' : 'Orange'})`, ok: await configureDevice(imei, 'apn', apn) });
  steps.push({ step: 'Scan BLE (détection domicile)', ok: await sendDeviceCommand(imei, 'enableBle') });
  steps.push({ step: 'Détection de retrait', ok: await setWearingDetection(imei, true) });

  const allOk = steps.every((s) => s.ok);
  const { writeAudit } = await import('@/lib/audit/log');
  await writeAudit({ userId: session.id, action: 'PROVISION_DEVICE', tableName: 'devices', recordId: imei, newData: { apn, steps } });

  return NextResponse.json({ ok: true, allOk, steps });
}
