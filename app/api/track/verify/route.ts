import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { verifyChain, type SealedRow } from '@/lib/track/seal';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// GET /api/track/verify?caseId=…[&date=YYYY-MM-DD]
//
// Recalcule la chaîne de scellés et dit si le journal de positions a été
// retouché. Réponse volontairement sobre : un nombre de relevés vérifiés, un
// verdict, et le premier point de rupture s'il y en a un.
const MAX_ROWS = 20000;

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const caseId = request.nextUrl.searchParams.get('caseId');
  const date = request.nextUrl.searchParams.get('date');
  if (!caseId) return NextResponse.json({ error: 'caseId requis' }, { status: 400 });

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return NextResponse.json({ error: 'Vérification indisponible en démonstration' }, { status: 503 });
  }

  const { createAdminClient } = await import('@/lib/supabase/admin');
  const sb = createAdminClient();
  if (!sb) return NextResponse.json({ error: 'Base indisponible' }, { status: 503 });

  // La chaîne appartient au bracelet, pas au dossier : c'est l'ordre dans
  // lequel l'appareil a émis. On la lit donc par device_id, en se limitant aux
  // relevés du dossier demandé.
  let q = sb
    .from('positions')
    .select('id, device_id, recorded_at, latitude, longitude, seal_seq, seal_prev, seal_hash')
    .eq('case_id', caseId)
    .order('seal_seq', { ascending: true })
    .limit(MAX_ROWS);
  if (date) {
    q = q.gte('recorded_at', `${date}T00:00:00Z`).lt('recorded_at', `${date}T23:59:59.999Z`);
  }

  const { data, error } = await q;
  if (error) {
    return NextResponse.json({ error: 'Chaîne indisponible — migration du scellé non appliquée' }, { status: 503 });
  }

  const rows = (data ?? []) as unknown as SealedRow[];
  const verdict = verifyChain(rows);

  // Trace la vérification elle-même : savoir qui a contrôlé, et quand, fait
  // partie de la valeur probante.
  const { logCaseAccess } = await import('@/lib/audit/access');
  await logCaseAccess({
    caseId, context: 'TRAJET',
    userId: session.id, actorName: session.full_name, actorRole: session.role,
  });

  return NextResponse.json({
    ...verdict,
    unsealed: verdict.checked - verdict.sealed,
    verifiedAt: new Date().toISOString(),
    verifiedBy: session.full_name,
  });
}
