import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

// Position des agents en escorte.
//
//   POST /api/track/agent  { lat, lng, accuracy?, caseId? }  — l'agent se signale
//   POST … { stop: true }                                    — il cesse le partage
//   GET  /api/track/agent                                    — positions récentes
//
// Une seule ligne par agent, remplacée à chaque relevé : c'est une position
// courante, pas un historique. Suivre un agent dans la durée serait une
// surveillance de salarié, hors sujet et inacceptable.
const FRESH_MS = 5 * 60_000;

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  let body: { lat?: number; lng?: number; accuracy?: number; caseId?: string; stop?: boolean };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'JSON invalide' }, { status: 400 }); }

  const { createAdminClient } = await import('@/lib/supabase/admin');
  const sb = createAdminClient();
  if (!sb) return NextResponse.json({ error: 'Base indisponible' }, { status: 503 });

  if (body.stop) {
    const { error } = await sb.from('agent_positions').delete().eq('user_id', session.id);
    if (error) return NextResponse.json({ error: 'Escorte indisponible — migration non appliquée' }, { status: 503 });
    return NextResponse.json({ ok: true, sharing: false });
  }

  if (typeof body.lat !== 'number' || typeof body.lng !== 'number') {
    return NextResponse.json({ error: 'lat / lng requis' }, { status: 400 });
  }

  const { error } = await sb.from('agent_positions').upsert({
    user_id: session.id,
    latitude: body.lat,
    longitude: body.lng,
    accuracy_m: body.accuracy ?? null,
    case_id: body.caseId ?? null,
    recorded_at: new Date().toISOString(),
  });
  if (error) return NextResponse.json({ error: 'Escorte indisponible — migration non appliquée' }, { status: 503 });
  return NextResponse.json({ ok: true, sharing: true });
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ agents: [] }, { status: 401 });

  const { createAdminClient } = await import('@/lib/supabase/admin');
  const sb = createAdminClient();
  if (!sb) return NextResponse.json({ agents: [] });

  const { data, error } = await sb
    .from('agent_positions')
    .select('user_id, latitude, longitude, accuracy_m, case_id, recorded_at, user:users(full_name, role)')
    .gte('recorded_at', new Date(Date.now() - FRESH_MS).toISOString());
  // Table absente : pas d'agent, pas d'erreur — la console continue de tourner.
  if (error) return NextResponse.json({ agents: [] });

  return NextResponse.json({
    agents: (data ?? []).map((a) => ({
      userId: a.user_id as string,
      name: (a.user as unknown as { full_name?: string } | null)?.full_name ?? 'Agent',
      role: (a.user as unknown as { role?: string } | null)?.role ?? null,
      lat: a.latitude as number,
      lng: a.longitude as number,
      accuracy: (a.accuracy_m as number | null) ?? null,
      caseId: (a.case_id as string | null) ?? null,
      at: a.recorded_at as string,
    })),
  });
}
