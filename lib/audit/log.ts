// Server-only audit utility — import only from 'use server' files

interface AuditEntry {
  userId: string;
  action: string;
  tableName?: string;
  recordId?: string;
  oldData?: Record<string, unknown>;
  newData?: Record<string, unknown>;
}

export async function writeAudit(entry: AuditEntry): Promise<void> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return; // demo mode — no-op
  try {
    const { createAdminClient } = await import('@/lib/supabase/admin');
    const supabase = createAdminClient();
    if (!supabase) return;
    // Snapshot the actor's name so the audit trail stays readable even after the
    // account is deleted (user_id becomes NULL, actor_name preserves identity).
    let actorName: string | null = null;
    try {
      const { data } = await supabase.from('users').select('full_name').eq('id', entry.userId).maybeSingle();
      actorName = (data as { full_name?: string } | null)?.full_name ?? null;
    } catch { /* keep null */ }
    await supabase.from('audit_log').insert({
      user_id: entry.userId,
      actor_name: actorName,
      action: entry.action,
      table_name: entry.tableName ?? null,
      record_id: entry.recordId ?? null,
      old_data: entry.oldData ?? null,
      new_data: entry.newData ?? null,
    });
  } catch {
    // Audit failures must never break the main operation
  }
}
