import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { buildProfile, assess } from '@/lib/track/baseline';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// GET /api/track/baseline?caseId=…
//
// Compare la position du moment à l'habitude de la personne, heure par heure,
// sur les trente derniers jours. Répond « habituel », « inhabituel » ou
// « insuffisant » — jamais un score obscur : ce qui est présenté à un magistrat
// doit pouvoir être expliqué et contesté.
const WINDOW_DAYS = 30;
const MAX_POINTS = 20000;

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const caseId = request.nextUrl.searchParams.get('caseId');
  if (!caseId) return NextResponse.json({ error: 'caseId requis' }, { status: 400 });
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return NextResponse.json({ error: 'Indisponible en démonstration' }, { status: 503 });
  }

  const { createAdminClient } = await import('@/lib/supabase/admin');
  const sb = createAdminClient();
  if (!sb) return NextResponse.json({ error: 'Base indisponible' }, { status: 503 });

  const since = new Date(Date.now() - WINDOW_DAYS * 86400_000).toISOString();
  const { data } = await sb
    .from('positions')
    .select('latitude, longitude, recorded_at')
    .eq('case_id', caseId)
    .gte('recorded_at', since)
    .order('recorded_at', { ascending: false })
    .limit(MAX_POINTS);

  const rows = (data ?? []) as { latitude: number; longitude: number; recorded_at: string }[];
  if (rows.length === 0) {
    return NextResponse.json({ verdict: 'insuffisant', explanation: 'Aucun relevé sur les trente derniers jours.' });
  }

  const points = rows.map((r) => ({ lat: r.latitude, lng: r.longitude, t: Date.parse(r.recorded_at) }));
  // Le plus récent sert de position à juger ; l'habitude se construit sur tout
  // le reste, celle du jour même comprise — un lieu fréquenté depuis ce matin
  // n'est pas encore une habitude, et le comptage le reflète naturellement.
  const [current, ...history] = points;
  const profile = buildProfile(history);
  const verdict = assess(profile, current);

  return NextResponse.json({
    ...verdict,
    points: profile.points,
    from: profile.from,
    to: profile.to,
    currentAt: new Date(current.t).toISOString(),
  });
}
