// SMS notification gateway — generic HTTP provider, configured in settings.
// Compatible with most Burkina Faso SMS aggregators (Orange / Moov resellers):
// a POST endpoint accepting { to, from, message } with a Bearer API key.
// No-op when SMS is disabled or unconfigured.
import { getSettings } from '@/lib/settings';

export async function sendSms(to: string | null | undefined, message: string): Promise<boolean> {
  if (!to) return false;
  const s = await getSettings();
  if (!s.sms_enabled || !s.sms_endpoint) return false;
  try {
    const res = await fetch(s.sms_endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(s.sms_api_key ? { Authorization: `Bearer ${s.sms_api_key}` } : {}),
      },
      body: JSON.stringify({ to, from: s.sms_sender ?? 'SIGEP', message }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
