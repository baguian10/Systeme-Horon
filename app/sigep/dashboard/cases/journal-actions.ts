'use server';

import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/auth/session';
import { canWriteJournal } from '@/lib/auth/permissions';
import type { JournalEntryType } from '@/lib/supabase/types';

const isDemoMode = () => !process.env.NEXT_PUBLIC_SUPABASE_URL;

export async function addJournalEntryAction(
  _: { error: string } | null,
  formData: FormData,
): Promise<{ error: string } | null> {
  const session = await getSession();
  if (!session || !canWriteJournal(session.role)) return { error: 'Accès refusé' };

  const case_id    = formData.get('case_id') as string;
  const entry_type = formData.get('entry_type') as JournalEntryType;
  const content    = (formData.get('content') as string)?.trim();

  if (!case_id || !entry_type || !content) return { error: 'Champs obligatoires manquants' };

  if (isDemoMode()) {
    const { MOCK_JOURNAL_ENTRIES } = await import('@/lib/mock/data');
    MOCK_JOURNAL_ENTRIES.push({
      id: `je-${Date.now()}`,
      case_id,
      author_id: session.id,
      author_name: session.full_name,
      author_role: session.role,
      entry_type,
      content,
      created_at: new Date().toISOString(),
    });
    revalidatePath(`/sigep/dashboard/cases/${case_id}`);
    return null;
  }

  const { createAdminClient } = await import('@/lib/supabase/admin');
  const supabase = createAdminClient();
  if (!supabase) return { error: 'Base de données indisponible' };
  const { error } = await supabase.from('journal_entries').insert({
    case_id, entry_type, content, author_id: session.id,
  });
  if (error) return { error: 'Erreur lors de l\'ajout de l\'entrée' };
  revalidatePath(`/sigep/dashboard/cases/${case_id}`);
  return null;
}
