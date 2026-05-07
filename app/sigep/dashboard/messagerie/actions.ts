'use server';

import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/auth/session';
import { writeAudit } from '@/lib/audit/log';

const isDemoMode = () => !process.env.NEXT_PUBLIC_SUPABASE_URL;

export async function createThreadAction(
  _: { error?: string; success?: boolean } | null,
  formData: FormData,
): Promise<{ error?: string; success?: boolean } | null> {
  const session = await getSession();
  if (!session) return { error: 'Accès refusé' };

  const subject     = (formData.get('subject') as string)?.trim();
  const content     = (formData.get('content') as string)?.trim();
  const case_number = (formData.get('case_number') as string)?.trim() || null;

  if (!subject || !content) return { error: 'Sujet et message requis' };

  if (isDemoMode()) {
    const { MOCK_THREADS, MOCK_MESSAGES, MOCK_CASES } = await import('@/lib/mock/data');
    const relatedCase = case_number ? MOCK_CASES.find((c) => c.case_number === case_number) : null;
    const threadId = `th-${Date.now()}`;
    MOCK_THREADS.push({
      id: threadId,
      case_id: relatedCase?.id ?? null,
      case_number: case_number,
      subject,
      participant_ids: [session.id],
      last_message_at: new Date().toISOString(),
      last_message_preview: content.slice(0, 80),
      created_by: session.id,
      created_at: new Date().toISOString(),
    });
    MOCK_MESSAGES.push({
      id: `msg-${Date.now()}`,
      thread_id: threadId,
      sender_id: session.id,
      sender_name: session.full_name,
      sender_role: session.role,
      content,
      is_read_by: [session.id],
      created_at: new Date().toISOString(),
    });
    await writeAudit({ userId: session.id, action: 'CREATE_THREAD', tableName: 'threads', recordId: threadId, newData: { subject } });
    revalidatePath('/sigep/dashboard/messagerie');
    return { success: true };
  }

  return { success: true };
}

export async function sendMessageAction(
  _: { error?: string } | null,
  formData: FormData,
): Promise<{ error?: string } | null> {
  const session = await getSession();
  if (!session) return { error: 'Accès refusé' };

  const thread_id = formData.get('thread_id') as string;
  const content   = (formData.get('content') as string)?.trim();
  if (!thread_id || !content) return { error: 'Message vide' };

  if (isDemoMode()) {
    const { MOCK_MESSAGES, MOCK_THREADS } = await import('@/lib/mock/data');
    const msgId = `msg-${Date.now()}`;
    MOCK_MESSAGES.push({
      id: msgId,
      thread_id,
      sender_id: session.id,
      sender_name: session.full_name,
      sender_role: session.role,
      content,
      is_read_by: [session.id],
      created_at: new Date().toISOString(),
    });
    const thread = MOCK_THREADS.find((t) => t.id === thread_id);
    if (thread) {
      thread.last_message_at = new Date().toISOString();
      thread.last_message_preview = content.slice(0, 80);
      if (!thread.participant_ids.includes(session.id)) thread.participant_ids.push(session.id);
    }
    revalidatePath(`/sigep/dashboard/messagerie/${thread_id}`);
    revalidatePath('/sigep/dashboard/messagerie');
    return null;
  }

  return null;
}
