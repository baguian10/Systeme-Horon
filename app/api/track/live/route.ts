import { NextResponse } from 'next/server';
import { isTraxbeanConfigured, getDeviceLocation } from '@/lib/traxbean/client';

export const dynamic = 'force-dynamic';

// GET /api/track/live  — debug/proof endpoint.
// Returns the raw live position of TRAXBEAN_DEMO_IMEI pulled from Traxbean.
export async function GET() {
  const imei = process.env.TRAXBEAN_DEMO_IMEI;
  if (!isTraxbeanConfigured()) {
    return NextResponse.json({ ok: false, reason: 'TRAXBEAN_TOKEN missing' }, { status: 503 });
  }
  if (!imei) {
    return NextResponse.json({ ok: false, reason: 'TRAXBEAN_DEMO_IMEI missing' }, { status: 400 });
  }
  const live = await getDeviceLocation(imei);
  if (!live) {
    return NextResponse.json({ ok: false, reason: 'no fix / fetch failed', imei }, { status: 502 });
  }
  return NextResponse.json({ ok: true, live });
}
