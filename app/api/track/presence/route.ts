import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { getHomePresence } from '@/lib/traxbean/client';

export const dynamic = 'force-dynamic';

// GET /api/track/presence?imei=... — BLE home-beacon presence for a bracelet.
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const imei = request.nextUrl.searchParams.get('imei');
  if (!imei) return NextResponse.json({ error: 'imei manquant' }, { status: 400 });
  const presence = await getHomePresence(imei);
  return NextResponse.json(presence);
}
