import { type NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { reverseGeocode } from '@/lib/geo/reverse';

export const dynamic = 'force-dynamic';

// GET /api/geo/reverse?lat=..&lng=.. → { address } (Nominatim, cached server-side)
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ address: null }, { status: 401 });
  const lat = Number(request.nextUrl.searchParams.get('lat'));
  const lng = Number(request.nextUrl.searchParams.get('lng'));
  if (Number.isNaN(lat) || Number.isNaN(lng)) return NextResponse.json({ address: null }, { status: 400 });
  const address = await reverseGeocode(lat, lng);
  return NextResponse.json({ address });
}
