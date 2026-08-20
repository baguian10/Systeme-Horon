import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { logCaseAccess, type AccessContext } from '@/lib/audit/access';

export const dynamic = 'force-dynamic';

// POST /api/cases/access — enregistre une consultation ouverte depuis la
// console : fiche de suivi, panneau d'incident. Les consultations faites côté
// serveur (dossier, trajet, export) s'enregistrent d'elles-mêmes.
const CONTEXTS: AccessContext[] = ['SUIVI', 'INCIDENT'];

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  let body: { caseId?: string; context?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'JSON invalide' }, { status: 400 }); }
  const caseId = body.caseId?.trim();
  const context = body.context as AccessContext;
  if (!caseId || !CONTEXTS.includes(context)) {
    return NextResponse.json({ error: 'caseId / context invalide' }, { status: 400 });
  }

  await logCaseAccess({
    caseId, context,
    userId: session.id, actorName: session.full_name, actorRole: session.role,
    ip: request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? null,
  });
  return NextResponse.json({ ok: true });
}
