import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

// POST /api/push/subscribe — persist a browser push subscription for the user.
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  let body: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'JSON invalide' }, { status: 400 }); }
  const endpoint = body.endpoint;
  const p256dh = body.keys?.p256dh;
  const auth = body.keys?.auth;
  if (!endpoint || !p256dh || !auth) return NextResponse.json({ error: 'Abonnement incomplet' }, { status: 400 });

  const { createAdminClient } = await import('@/lib/supabase/admin');
  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json({ error: 'Indisponible' }, { status: 503 });

  // Upsert on the unique endpoint so re-subscribing the same browser is idempotent.
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert({ user_id: session.id, endpoint, p256dh, auth }, { onConflict: 'endpoint' });
  if (error) return NextResponse.json({ error: "Échec de l'enregistrement" }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE /api/push/subscribe — remove a subscription (on unsubscribe).
export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  let body: { endpoint?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'JSON invalide' }, { status: 400 }); }
  if (!body.endpoint) return NextResponse.json({ error: 'endpoint requis' }, { status: 400 });

  const { createAdminClient } = await import('@/lib/supabase/admin');
  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json({ error: 'Indisponible' }, { status: 503 });
  await supabase.from('push_subscriptions').delete().eq('endpoint', body.endpoint).eq('user_id', session.id);
  return NextResponse.json({ ok: true });
}
