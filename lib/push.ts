// Web Push sender. No-op unless VAPID keys are configured
// (NEXT_PUBLIC_VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY). Expired subscriptions
// (HTTP 404/410) are pruned. Never throws to the caller.
import webpush from 'web-push';

const PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const PRIVATE = process.env.VAPID_PRIVATE_KEY;
const SUBJECT = process.env.VAPID_SUBJECT ?? 'mailto:admin@sigep.bf';

let configured = false;
function ensureConfigured(): boolean {
  if (configured) return true;
  if (!PUBLIC || !PRIVATE) return false;
  webpush.setVapidDetails(SUBJECT, PUBLIC, PRIVATE);
  configured = true;
  return true;
}

export function isPushConfigured(): boolean {
  return Boolean(PUBLIC && PRIVATE);
}

export type PushPayload = { title: string; body: string; url?: string; tag?: string };

// Minimal shape of the supabase admin client used here.
type Sb = {
  from: (t: string) => {
    select: (c: string) => { eq: (col: string, v: string) => Promise<{ data: PushRow[] | null }> };
    delete: () => { eq: (col: string, v: string) => Promise<unknown> };
  };
};
type PushRow = { id: string; endpoint: string; p256dh: string; auth: string };

export async function sendPushToUser(sb: Sb, userId: string, payload: PushPayload): Promise<void> {
  if (!ensureConfigured()) return;
  try {
    const { data: subs } = await sb.from('push_subscriptions').select('id, endpoint, p256dh, auth').eq('user_id', userId);
    await Promise.all((subs ?? []).map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
        );
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) {
          await sb.from('push_subscriptions').delete().eq('id', s.id);
        }
      }
    }));
  } catch {
    /* best-effort */
  }
}
