'use server';

import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/auth/session';
import { canWriteJournal } from '@/lib/auth/permissions';

const isDemoMode = () =>
  !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export interface TerrainQueuedAction {
  type: 'CHECK_IN' | 'JOURNAL';
  case_id: string;
  case_number: string;
  payload: { content?: string; location?: string | null; timestamp: string };
}

// Persists the offline field queue: each check-in / note becomes a journal
// entry on the case. Returns per-item success so the client only clears what
// was actually saved.
export async function syncTerrainQueueAction(
  actions: TerrainQueuedAction[],
): Promise<{ synced: number; failed: number; error?: string }> {
  const session = await getSession();
  if (!session || !canWriteJournal(session.role)) {
    return { synced: 0, failed: actions.length, error: 'Accès refusé' };
  }
  if (!Array.isArray(actions) || actions.length === 0) return { synced: 0, failed: 0 };
  if (actions.length > 100) return { synced: 0, failed: actions.length, error: 'File trop longue (max 100)' };

  const toEntry = (a: TerrainQueuedAction) => {
    const when = new Date(a.payload.timestamp).toLocaleString('fr-FR', {
      timeZone: 'Africa/Ouagadougou', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
    });
    return a.type === 'CHECK_IN'
      ? {
          entry_type: 'POSITIVE' as const,
          content: `Check-in terrain effectué le ${when}${a.payload.location ? ` — ${a.payload.location}` : ''}.`,
        }
      : {
          entry_type: 'NEUTRAL' as const,
          content: `[Terrain ${when}] ${a.payload.content ?? ''}`.trim(),
        };
  };

  if (isDemoMode()) {
    const { MOCK_JOURNAL_ENTRIES } = await import('@/lib/mock/data');
    for (const a of actions) {
      const e = toEntry(a);
      MOCK_JOURNAL_ENTRIES.push({
        id: `je-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
        case_id: a.case_id,
        author_id: session.id,
        author_name: session.full_name,
        author_role: session.role,
        entry_type: e.entry_type,
        content: e.content,
        created_at: new Date().toISOString(),
      });
      revalidatePath(`/sigep/dashboard/cases/${a.case_id}`);
    }
    return { synced: actions.length, failed: 0 };
  }

  const { createAdminClient } = await import('@/lib/supabase/admin');
  const supabase = createAdminClient();
  if (!supabase) return { synced: 0, failed: actions.length, error: 'Base de données indisponible' };

  let synced = 0;
  let failed = 0;
  for (const a of actions) {
    if (!a.case_id || !a.type) { failed++; continue; }
    const e = toEntry(a);
    const { error } = await supabase.from('journal_entries').insert({
      case_id: a.case_id,
      entry_type: e.entry_type,
      content: e.content,
      author_id: session.id,
      author_name: session.full_name,
    });
    if (error) { failed++; continue; }
    synced++;
    revalidatePath(`/sigep/dashboard/cases/${a.case_id}`);
  }
  return { synced, failed };
}
