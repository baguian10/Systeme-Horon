'use server';

import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/auth/session';
import { writeAudit } from '@/lib/audit/log';

const isDemoMode = () =>
  !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function createThreadAction(
  _: { error?: string; success?: boolean } | null,
  formData: FormData,
): Promise<{ error?: string; success?: boolean } | null> {
  const session = await getSession();
  if (!session) return { error: 'Accès refusé' };

  const subject     = (formData.get('subject') as string)?.trim();
  const content     = (formData.get('content') as string)?.trim();
  const case_number = (formData.get('case_number') as string)?.trim() || null;
  const recipientIds = (formData.getAll('recipient_ids') as string[]).filter(Boolean);

  if (!subject || !content) return { error: 'Sujet et message requis' };
  if (recipientIds.length === 0) return { error: 'Sélectionnez au moins un destinataire' };
  if (recipientIds.length > 20) return { error: 'Maximum 20 destinataires' };

  // Participants = sender + recipients. Without recipients the thread was
  // invisible to everyone but its creator (fetchThreads filters on membership).
  const participants = Array.from(new Set([session.id, ...recipientIds]));

  if (isDemoMode()) {
    const { MOCK_THREADS, MOCK_MESSAGES, MOCK_CASES } = await import('@/lib/mock/data');
    const relatedCase = case_number ? MOCK_CASES.find((c) => c.case_number === case_number) : null;
    const threadId = `th-${Date.now()}`;
    MOCK_THREADS.push({
      id: threadId,
      case_id: relatedCase?.id ?? null,
      case_number: case_number,
      subject,
      participant_ids: participants,
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

  const { createAdminClient } = await import('@/lib/supabase/admin');
  const supabase = createAdminClient();
  if (!supabase) return { error: 'Base de données indisponible' };
  let case_id: string | null = null;
  if (case_number) {
    const { data: c } = await supabase.from('cases').select('id').eq('case_number', case_number).maybeSingle();
    case_id = c?.id ?? null;
  }
  // Verify every recipient is a real active account.
  const { data: found } = await supabase
    .from('users').select('id').in('id', recipientIds).eq('is_active', true);
  if ((found ?? []).length !== recipientIds.length) {
    return { error: 'Un des destinataires est introuvable ou inactif' };
  }

  const { data: thread, error } = await supabase.from('message_threads').insert({
    case_id, subject, participant_ids: participants,
    last_message_at: new Date().toISOString(), last_message_preview: content.slice(0, 80),
    created_by: session.id,
  }).select('id').single();
  if (error || !thread) return { error: 'Erreur lors de la création du fil' };
  await supabase.from('messages').insert({
    thread_id: thread.id, sender_id: session.id, sender_name: session.full_name, content, is_read_by: [session.id],
  });
  await writeAudit({ userId: session.id, action: 'CREATE_THREAD', tableName: 'message_threads', recordId: thread.id, newData: { subject } });

  // Push-notify recipients (best-effort).
  try {
    const { sendPushToUser } = await import('@/lib/push');
    await Promise.all(recipientIds.map((rid) =>
      sendPushToUser(supabase as unknown as Parameters<typeof sendPushToUser>[0], rid, {
        title: `SIGEP — Nouveau message de ${session.full_name}`,
        body: subject,
        url: `/sigep/dashboard/messagerie/${thread.id}`,
        tag: `thread-${thread.id}`,
      })));
  } catch {}

  revalidatePath('/sigep/dashboard/messagerie');
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
  if (content.length > 5000) return { error: 'Message trop long (max 5000 caractères)' };

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

  const { createAdminClient } = await import('@/lib/supabase/admin');
  const supabase = createAdminClient();
  if (!supabase) return { error: 'Base de données indisponible' };

  // Membership check: only participants may post (was open to any thread id).
  const { data: t } = await supabase.from('message_threads').select('participant_ids, subject, closed_at').eq('id', thread_id).maybeSingle();
  if (!t) return { error: 'Fil introuvable' };
  if ((t as { closed_at?: string | null }).closed_at) return { error: 'Fil clôturé — lecture seule' };
  const participants = (t.participant_ids as string[] | null) ?? [];
  if (!participants.includes(session.id)) return { error: 'Vous ne participez pas à ce fil' };

  const { error } = await supabase.from('messages').insert({
    thread_id, sender_id: session.id, sender_name: session.full_name, content, is_read_by: [session.id],
  });
  if (error) return { error: "Échec de l'envoi" };
  await supabase.from('message_threads').update({
    last_message_at: new Date().toISOString(),
    last_message_preview: content.slice(0, 80),
  }).eq('id', thread_id);

  // Push-notify the other participants (best-effort).
  try {
    const { sendPushToUser } = await import('@/lib/push');
    await Promise.all(participants.filter((p) => p !== session.id).map((rid) =>
      sendPushToUser(supabase as unknown as Parameters<typeof sendPushToUser>[0], rid, {
        title: `SIGEP — ${session.full_name}`,
        body: content.slice(0, 120),
        url: `/sigep/dashboard/messagerie/${thread_id}`,
        tag: `thread-${thread_id}`,
      })));
  } catch {}

  revalidatePath(`/sigep/dashboard/messagerie/${thread_id}`);
  revalidatePath('/sigep/dashboard/messagerie');
  return null;
}

// ── Participant management (creator or SUPER_ADMIN) ──────────────────────────

async function canAdministerThread(
  supabase: NonNullable<Awaited<ReturnType<typeof import('@/lib/supabase/admin')['createAdminClient']>>>,
  sessionId: string,
  role: string,
  threadId: string,
): Promise<{ ok: boolean; participants: string[]; created_by: string | null; closed_at: string | null }> {
  const { data: t } = await supabase.from('message_threads')
    .select('participant_ids, created_by, closed_at').eq('id', threadId).maybeSingle();
  if (!t) return { ok: false, participants: [], created_by: null, closed_at: null };
  const participants = (t.participant_ids as string[] | null) ?? [];
  const created_by = (t as { created_by?: string | null }).created_by ?? null;
  const closed_at = (t as { closed_at?: string | null }).closed_at ?? null;
  const ok = role === 'SUPER_ADMIN' || created_by === sessionId;
  return { ok, participants, created_by, closed_at };
}

export async function addParticipantAction(formData: FormData): Promise<{ error?: string } | void> {
  const session = await getSession();
  if (!session) return { error: 'Accès refusé' };
  const thread_id = formData.get('thread_id') as string;
  const user_id = formData.get('user_id') as string;
  if (!thread_id || !user_id) return { error: 'Champs manquants' };
  if (isDemoMode()) {
    const { MOCK_THREADS } = await import('@/lib/mock/data');
    const t = MOCK_THREADS.find((x) => x.id === thread_id);
    if (t && !t.participant_ids.includes(user_id)) t.participant_ids.push(user_id);
    revalidatePath(`/sigep/dashboard/messagerie/${thread_id}`);
    return;
  }
  const { createAdminClient } = await import('@/lib/supabase/admin');
  const supabase = createAdminClient();
  if (!supabase) return { error: 'Base de données indisponible' };
  const ctx = await canAdministerThread(supabase, session.id, session.role, thread_id);
  if (!ctx.ok) return { error: 'Seul le créateur du fil ou un SUPER_ADMIN peut gérer les participants' };
  if (ctx.closed_at) return { error: 'Fil clôturé' };
  if (ctx.participants.includes(user_id)) return { error: 'Déjà participant' };
  if (ctx.participants.length >= 30) return { error: 'Maximum 30 participants' };
  const { data: u } = await supabase.from('users').select('id, full_name').eq('id', user_id).eq('is_active', true).maybeSingle();
  if (!u) return { error: 'Utilisateur introuvable ou inactif' };
  await supabase.from('message_threads')
    .update({ participant_ids: [...ctx.participants, user_id] }).eq('id', thread_id);
  await writeAudit({ userId: session.id, action: 'THREAD_ADD_PARTICIPANT', tableName: 'message_threads', recordId: thread_id, newData: { user_id } });
  // Notify the newcomer.
  try {
    const { sendPushToUser } = await import('@/lib/push');
    await sendPushToUser(supabase as unknown as Parameters<typeof sendPushToUser>[0], user_id, {
      title: 'SIGEP — Ajouté à une conversation',
      body: `${session.full_name} vous a ajouté à un fil de discussion.`,
      url: `/sigep/dashboard/messagerie/${thread_id}`,
      tag: `thread-${thread_id}`,
    });
  } catch {}
  revalidatePath(`/sigep/dashboard/messagerie/${thread_id}`);
  revalidatePath('/sigep/dashboard/messagerie');
}

export async function removeParticipantAction(formData: FormData): Promise<{ error?: string } | void> {
  const session = await getSession();
  if (!session) return { error: 'Accès refusé' };
  const thread_id = formData.get('thread_id') as string;
  const user_id = formData.get('user_id') as string;
  if (!thread_id || !user_id) return { error: 'Champs manquants' };
  if (isDemoMode()) {
    const { MOCK_THREADS } = await import('@/lib/mock/data');
    const t = MOCK_THREADS.find((x) => x.id === thread_id);
    if (t) t.participant_ids = t.participant_ids.filter((p) => p !== user_id);
    revalidatePath(`/sigep/dashboard/messagerie/${thread_id}`);
    return;
  }
  const { createAdminClient } = await import('@/lib/supabase/admin');
  const supabase = createAdminClient();
  if (!supabase) return { error: 'Base de données indisponible' };
  const ctx = await canAdministerThread(supabase, session.id, session.role, thread_id);
  if (!ctx.ok) return { error: 'Seul le créateur du fil ou un SUPER_ADMIN peut gérer les participants' };
  if (user_id === ctx.created_by) return { error: 'Le créateur du fil ne peut pas être retiré' };
  if (ctx.participants.length <= 2) return { error: 'Un fil doit garder au moins 2 participants' };
  await supabase.from('message_threads')
    .update({ participant_ids: ctx.participants.filter((p) => p !== user_id) }).eq('id', thread_id);
  await writeAudit({ userId: session.id, action: 'THREAD_REMOVE_PARTICIPANT', tableName: 'message_threads', recordId: thread_id, newData: { user_id } });
  revalidatePath(`/sigep/dashboard/messagerie/${thread_id}`);
  revalidatePath('/sigep/dashboard/messagerie');
}

// ── Thread lifecycle: close (read-only archive) / reopen ─────────────────────

export async function closeThreadAction(formData: FormData): Promise<{ error?: string } | void> {
  const session = await getSession();
  if (!session) return { error: 'Accès refusé' };
  const thread_id = formData.get('thread_id') as string;
  if (!thread_id) return { error: 'Fil manquant' };
  if (isDemoMode()) { revalidatePath(`/sigep/dashboard/messagerie/${thread_id}`); return; }
  const { createAdminClient } = await import('@/lib/supabase/admin');
  const supabase = createAdminClient();
  if (!supabase) return { error: 'Base de données indisponible' };
  const ctx = await canAdministerThread(supabase, session.id, session.role, thread_id);
  if (!ctx.ok) return { error: 'Seul le créateur du fil ou un SUPER_ADMIN peut clôturer' };
  if (ctx.closed_at) return { error: 'Fil déjà clôturé' };
  await supabase.from('message_threads')
    .update({ closed_at: new Date().toISOString(), closed_by: session.id }).eq('id', thread_id);
  await writeAudit({ userId: session.id, action: 'THREAD_CLOSE', tableName: 'message_threads', recordId: thread_id });
  revalidatePath(`/sigep/dashboard/messagerie/${thread_id}`);
  revalidatePath('/sigep/dashboard/messagerie');
}

export async function reopenThreadAction(formData: FormData): Promise<{ error?: string } | void> {
  const session = await getSession();
  if (!session || session.role !== 'SUPER_ADMIN') return { error: 'Réouverture réservée au SUPER_ADMIN' };
  const thread_id = formData.get('thread_id') as string;
  if (!thread_id) return { error: 'Fil manquant' };
  if (isDemoMode()) { revalidatePath(`/sigep/dashboard/messagerie/${thread_id}`); return; }
  const { createAdminClient } = await import('@/lib/supabase/admin');
  const supabase = createAdminClient();
  if (!supabase) return { error: 'Base de données indisponible' };
  await supabase.from('message_threads')
    .update({ closed_at: null, closed_by: null }).eq('id', thread_id);
  await writeAudit({ userId: session.id, action: 'THREAD_REOPEN', tableName: 'message_threads', recordId: thread_id });
  revalidatePath(`/sigep/dashboard/messagerie/${thread_id}`);
  revalidatePath('/sigep/dashboard/messagerie');
}
