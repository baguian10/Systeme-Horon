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
    await supabase.from('audit_log').insert({
      user_id: entry.userId,
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
