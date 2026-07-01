// Best-effort alert notification dispatch, driven by per-user preferences.
// When an alert fires, the case's judge and assigned agents are notified on the
// channels their saved preferences enable for that alert type. Only SMS is
// wired today (push/email have no provider yet); those channels are ignored.
// Never throws — notification failures must not break the ingest pipeline.
import { sendSms } from '@/lib/sms';

type Prefs = Record<string, Record<string, boolean>>;

const LABELS: Record<string, string> = {
  GEOFENCE_EXIT:    'Sortie de zone',
  CURFEW_VIOLATION: 'Couvre-feu',
  TAMPER_DETECTED:  'Anti-sabotage',
  HEALTH_CRITICAL:  'Sante critique',
  BATTERY_LOW:      'Batterie faible',
  SIGNAL_LOST:      'Signal perdu',
  PANIC_BUTTON:     'Bouton panique',
};

export async function dispatchAlertNotifications(params: {
  caseId: string | null;
  alertType: string;
  description?: string | null;
}): Promise<void> {
  const { caseId, alertType } = params;
  if (!caseId) return;
  try {
    const { createAdminClient } = await import('@/lib/supabase/admin');
    const sb = createAdminClient();
    if (!sb) return;

    const [{ data: c }, { data: assigns }] = await Promise.all([
      sb.from('cases').select('judge_id, case_number').eq('id', caseId).maybeSingle(),
      sb.from('case_assignments').select('operational_id').eq('case_id', caseId),
    ]);

    const ids = [
      (c as { judge_id?: string } | null)?.judge_id,
      ...(((assigns ?? []) as { operational_id: string }[]).map((a) => a.operational_id)),
    ].filter(Boolean) as string[];
    if (ids.length === 0) return;

    const { data: users } = await sb.from('users').select('id, phone, notification_prefs').in('id', ids);

    const label = LABELS[alertType] ?? alertType;
    const ref = (c as { case_number?: string } | null)?.case_number;
    const message = `SIGEP - ALERTE ${label}${ref ? ` (${ref})` : ''}.${params.description ? ' ' + params.description : ''} Verifiez la plateforme.`;

    const { sendPushToUser } = await import('@/lib/push');

    await Promise.all(
      ((users ?? []) as { id: string; phone: string | null; notification_prefs: Prefs | null }[]).map(async (u) => {
        const prefs = u.notification_prefs?.[alertType];
        if (!prefs) return;
        if (prefs.sms && u.phone) await sendSms(u.phone, message);
        if (prefs.push) {
          await sendPushToUser(sb as unknown as Parameters<typeof sendPushToUser>[0], u.id, {
            title: `SIGEP — ${label}${ref ? ` (${ref})` : ''}`,
            body: params.description ?? 'Nouvelle alerte. Vérifiez la plateforme.',
            url: caseId ? `/sigep/dashboard/cases/${caseId}` : '/sigep/dashboard/monitoring',
            tag: `alert-${caseId}`,
          });
        }
      }),
    );
  } catch {
    /* best-effort — never break the caller */
  }
}
