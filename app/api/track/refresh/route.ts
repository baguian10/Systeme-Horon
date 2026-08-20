import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { fetchLatestPositions } from '@/lib/mock/helpers';
import { isTraxbeanConfigured, getDeviceLocation } from '@/lib/traxbean/client';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// GET /api/track/refresh — battement de la console temps réel.
//
// Chemin court, volontairement : il ne va chercher que la position et la fait
// passer par l'ingestion normale, qui applique géofences et alertes. Tout le
// reste — scan BLE, état de la sangle, constantes de santé, télémétrie — reste
// au passage complet du collecteur, qui prend une dizaine de secondes et
// n'aurait aucun sens à ce rythme.
//
// La console l'appelle toutes les dix secondes, le rythme d'émission du
// bracelet. Le résultat suit le terrain au lieu d'afficher le dernier passage.
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ positions: [] }, { status: 401 });

  if (isTraxbeanConfigured() && process.env.NEXT_PUBLIC_SUPABASE_URL) {
    try {
      const { createAdminClient } = await import('@/lib/supabase/admin');
      const sb = createAdminClient();
      if (sb) {
        const { data: devices } = await sb
          .from('devices').select('imei').not('case_id', 'is', null);
        const origin = request.nextUrl.origin;
        const ingestKey = process.env.INGEST_API_KEY ?? '';
        await Promise.all(((devices ?? []) as { imei: string }[]).map(async (d) => {
          const live = await getDeviceLocation(d.imei);
          if (!live) return;
          // L'ingestion écarte d'elle-même une mesure déjà enregistrée : le
          // bracelet garde le même horodatage tant qu'il n'a pas recalculé.
          await fetch(`${origin}/api/ingest/position`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key': ingestKey },
            body: JSON.stringify({
              imei: d.imei, lat: live.lat, lon: live.lng,
              speed_kmh: live.speedKmh ?? undefined, timestamp: live.recordedAt,
            }),
          });
        }));
      }
    } catch { /* le battement suivant réessaiera */ }
  }

  // Charge utile maigre : coordonnées et horodatage. Le numéro de dossier, son
  // statut et son compte d'alertes viennent du rendu serveur — les recopier
  // alourdirait un appel qui revient six fois par minute.
  const positions = await fetchLatestPositions();
  return NextResponse.json({
    positions: positions.map((p) => ({
      case_id: p.case_id,
      device_id: p.device_id,
      latitude: p.latitude,
      longitude: p.longitude,
      speed_kmh: p.speed_kmh ?? null,
      recorded_at: p.recorded_at,
    })),
  });
}
