import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { canConfigureHardware , allow } from '@/lib/auth/permissions';

export const dynamic = 'force-dynamic';

// POST /api/devices/assign  — assign a bracelet to a case (or unassign).
// Body: { deviceId, caseId }  (caseId null/empty → unassign). SUPER_ADMIN only.
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || !allow(session, canConfigureHardware(session.role), 'hardware')) {
    return NextResponse.json({ error: 'Accès refusé (SUPER_ADMIN requis)' }, { status: 403 });
  }

  let body: { deviceId?: string; caseId?: string | null };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'JSON invalide' }, { status: 400 }); }

  const { deviceId } = body;
  const caseId = body.caseId || null;
  if (!deviceId) return NextResponse.json({ error: 'deviceId manquant' }, { status: 400 });

  const { createAdminClient } = await import('@/lib/supabase/admin');
  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json({ error: 'DB indisponible' }, { status: 503 });

  // A case holds at most one device (devices.case_id is UNIQUE) — free any prior one.
  if (caseId) {
    await supabase.from('devices').update({ case_id: null, assigned_at: null }).eq('case_id', caseId);
  }

  const { error } = await supabase
    .from('devices')
    .update({ case_id: caseId, assigned_at: caseId ? new Date().toISOString() : null })
    .eq('id', deviceId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  { const { writeAudit } = await import('@/lib/audit/log'); await writeAudit({ userId: session.id, action: 'ASSIGN_DEVICE', tableName: 'devices', recordId: deviceId, newData: { caseId } }); }
  return NextResponse.json({ ok: true });
}
