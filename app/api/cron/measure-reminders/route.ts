import { NextResponse, type NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// GET /api/cron/measure-reminders?secret=<CRON_SECRET>
// Notifies the judge (and assigned agents) when a non-permanent measure nears
// its end date, once per crossed threshold (7 / 3 / 1 days). Run daily.
const THRESHOLDS = [7, 3, 1];

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const provided = request.nextUrl.searchParams.get('secret') ?? request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (secret && provided !== secret) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return NextResponse.json({ ok: true, demo: true });

  const { createAdminClient } = await import('@/lib/supabase/admin');
  const sb = createAdminClient();
  if (!sb) return NextResponse.json({ error: 'DB unavailable' }, { status: 503 });

  const now = Date.now();
  const horizon = new Date(now + (THRESHOLDS[0] + 1) * 86400000).toISOString();
  const { data } = await sb
    .from('cases')
    .select('id, case_number, end_date, judge_id, expiry_reminder_stage')
    .in('status', ['ACTIVE', 'VIOLATION'])
    .eq('is_permanent', false)
    .not('end_date', 'is', null)
    .lte('end_date', horizon);

  type Row = { id: string; case_number: string; end_date: string; judge_id: string | null; expiry_reminder_stage: number | null };
  const rows = (data ?? []) as Row[];

  const { sendSms } = await import('@/lib/sms');
  const { sendPushToUser } = await import('@/lib/push');
  let notified = 0;

  for (const c of rows) {
    const daysLeft = Math.ceil((new Date(c.end_date).getTime() - now) / 86400000);
    // Smallest threshold the measure has now reached (most urgent).
    const stage = THRESHOLDS.find((t) => daysLeft <= t);
    if (stage == null) continue;
    // Already reminded at this stage or a more urgent one? skip.
    if (c.expiry_reminder_stage != null && c.expiry_reminder_stage <= stage) continue;
    if (!c.judge_id) continue;

    const { data: judge } = await sb.from('users').select('phone').eq('id', c.judge_id).maybeSingle();
    const phone = (judge as { phone?: string | null } | null)?.phone ?? null;
    const label = daysLeft <= 0 ? "arrive à échéance aujourd'hui" : `arrive à échéance dans ${daysLeft} j`;
    const msg = `SIGEP - La mesure du dossier ${c.case_number} ${label}. Prevoyez le renouvellement ou la mainlevee.`;
    if (phone) await sendSms(phone, msg);
    await sendPushToUser(sb as unknown as Parameters<typeof sendPushToUser>[0], c.judge_id, {
      title: `SIGEP — Échéance dossier ${c.case_number}`,
      body: `La mesure ${label}.`,
      url: `/sigep/dashboard/cases/${c.id}`,
      tag: `expiry-${c.id}`,
    });
    await sb.from('cases').update({ expiry_reminder_stage: stage }).eq('id', c.id);
    notified++;
  }

  // ── D-1 obligation reminders ────────────────────────────────────────────────
  // Every obligation scheduled TOMORROW and not yet reminded → push + SMS to
  // the case judge and the assigned field agents. One-shot via reminded_at.
  let obligationsReminded = 0;
  try {
    const tomorrow = new Date(now + 86400000).toISOString().slice(0, 10);
    const { data: obs } = await sb
      .from('obligations')
      .select('id, case_id, title, obligation_type, scheduled_date, start_time, location, case:cases(case_number, judge_id)')
      .eq('scheduled_date', tomorrow)
      .is('reminded_at', null)
      .limit(100);

    type Ob = { id: string; case_id: string; title: string; start_time: string | null; location: string | null; case?: { case_number?: string; judge_id?: string | null } | null };
    for (const ob of (obs ?? []) as Ob[]) {
      const ref = ob.case?.case_number ?? '';
      const when = ob.start_time ? ` à ${ob.start_time}` : '';
      const where = ob.location ? ` (${ob.location})` : '';
      const body = `Obligation demain${when} : ${ob.title}${where} — dossier ${ref}.`;

      // Recipients: case judge + assigned operational agents.
      const { data: assigns } = await sb.from('case_assignments').select('operational_id').eq('case_id', ob.case_id);
      const ids = [
        ob.case?.judge_id,
        ...(((assigns ?? []) as { operational_id: string }[]).map((a) => a.operational_id)),
      ].filter(Boolean) as string[];

      for (const uid of [...new Set(ids)]) {
        await sendPushToUser(sb as unknown as Parameters<typeof sendPushToUser>[0], uid, {
          title: `SIGEP — Rappel obligation (${ref})`,
          body,
          url: '/sigep/dashboard/agenda',
          tag: `obligation-${ob.id}`,
        });
        const { data: u } = await sb.from('users').select('phone').eq('id', uid).maybeSingle();
        const phone = (u as { phone?: string | null } | null)?.phone;
        if (phone) await sendSms(phone, `SIGEP - RAPPEL: ${body}`);
      }
      await sb.from('obligations').update({ reminded_at: new Date().toISOString() }).eq('id', ob.id);
      obligationsReminded++;
    }
  } catch { /* best-effort — never blocks the expiry reminders */ }

  return NextResponse.json({ ok: true, scanned: rows.length, notified, obligationsReminded });
}
