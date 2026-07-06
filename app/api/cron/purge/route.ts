import { NextResponse, type NextRequest } from 'next/server';
import { getSettings } from '@/lib/settings';

export const dynamic = 'force-dynamic';

// GET /api/cron/purge?secret=<CRON_SECRET>
// Applies the data-retention policy: deletes GPS positions and audit entries
// older than the configured retention. Run daily (cron-job.org or Vercel cron).
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const provided = request.nextUrl.searchParams.get('secret') ?? request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (secret && provided !== secret) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return NextResponse.json({ ok: true, demo: true });

  const settings = await getSettings();
  const { createAdminClient } = await import('@/lib/supabase/admin');
  const sb = createAdminClient();
  if (!sb) return NextResponse.json({ error: 'DB unavailable' }, { status: 503 });

  const posCutoff = new Date(Date.now() - settings.position_retention_days * 86400000).toISOString();
  const auditCutoff = new Date(Date.now() - settings.audit_retention_days * 86400000).toISOString();

  const pos = await sb.from('positions').delete().lt('recorded_at', posCutoff).select('id');
  const aud = await sb.from('audit_log').delete().lt('logged_at', auditCutoff).select('id');
  // Telemetry history follows the same retention as positions (both are GPS-era
  // time-series). Best-effort: the table may not exist before its migration.
  const tel = await sb.from('device_telemetry').delete().lt('recorded_at', posCutoff).select('id');

  return NextResponse.json({
    ok: true,
    purged_positions: pos.data?.length ?? 0,
    purged_audit: aud.data?.length ?? 0,
    purged_telemetry: tel.data?.length ?? 0,
    position_retention_days: settings.position_retention_days,
    audit_retention_days: settings.audit_retention_days,
  });
}
