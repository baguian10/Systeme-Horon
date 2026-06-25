import { NextResponse } from 'next/server';
import { fetchLatestPositions } from '@/lib/mock/helpers';

export const dynamic = 'force-dynamic';

// GET /api/track/positions — debug: shows exactly what the map receives.
export async function GET() {
  const positions = await fetchLatestPositions();
  return NextResponse.json({ count: positions.length, positions });
}
