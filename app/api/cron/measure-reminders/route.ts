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

  return NextResponse.json({ ok: true, scanned: rows.length, notified });
}
