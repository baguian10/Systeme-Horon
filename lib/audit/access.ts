// Journal des consultations — qui a regardé quel dossier, et quand.
//
// Distinct du journal d'audit, qui enregistre les actes de gestion : ici on
// enregistre le simple fait de regarder. Un fichier judiciaire nominatif doit
// pouvoir le dire, et cela protège aussi l'agent — une consultation tracée est
// une consultation défendable.
//
// Serveur uniquement.

export type AccessContext = 'DOSSIER' | 'SUIVI' | 'INCIDENT' | 'TRAJET' | 'EXPORT';

// Deux consultations du même dossier, par la même personne et dans le même
// contexte, ne font qu'une ligne dans cette fenêtre. Sans cela, une page qui se
// rafraîchit toutes les trente secondes écrirait deux mille lignes par jour et
// le journal deviendrait illisible — donc inutile.
const DEDUP_MINUTES = 15;

// Export : chaque dossier sorti du système est une divulgation à part entière,
// donc une ligne par dossier. Pas de dédoublonnage ici — deux exports successifs
// sont deux divulgations, et c'est précisément ce qu'un contrôle veut voir.
export async function logCaseAccessBulk(params: {
  caseIds: string[];
  context: AccessContext;
  userId: string;
  actorName?: string | null;
  actorRole?: string | null;
  ip?: string | null;
}): Promise<void> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || params.caseIds.length === 0) return;
  try {
    const { createAdminClient } = await import('@/lib/supabase/admin');
    const sb = createAdminClient();
    if (!sb) return;
    await sb.from('case_access_log').insert(params.caseIds.map((case_id) => ({
      case_id,
      user_id: params.userId,
      actor_name: params.actorName ?? null,
      actor_role: params.actorRole ?? null,
      context: params.context,
      ip_address: params.ip || null,
    })));
  } catch { /* jamais bloquant */ }
}

export async function logCaseAccess(params: {
  caseId: string;
  context: AccessContext;
  userId?: string;
  actorName?: string | null;
  actorRole?: string | null;
  ip?: string | null;
}): Promise<void> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return; // mode démonstration
  try {
    let { userId, actorName, actorRole, ip } = params;

    if (!userId) {
      const { getSession } = await import('@/lib/auth/session');
      const session = await getSession();
      if (!session) return; // pas de consultation anonyme à enregistrer
      userId = session.id;
      actorName = actorName ?? session.full_name ?? null;
      actorRole = actorRole ?? session.role ?? null;
    }

    if (ip === undefined) {
      try {
        const { headers } = await import('next/headers');
        const h = await headers();
        ip = h.get('x-forwarded-for')?.split(',')[0].trim() ?? null;
      } catch { ip = null; }
    }

    const { createAdminClient } = await import('@/lib/supabase/admin');
    const sb = createAdminClient();
    if (!sb) return;

    const since = new Date(Date.now() - DEDUP_MINUTES * 60000).toISOString();
    const { count } = await sb
      .from('case_access_log')
      .select('id', { count: 'exact', head: true })
      .eq('case_id', params.caseId)
      .eq('user_id', userId)
      .eq('context', params.context)
      .gte('viewed_at', since);
    if (count) return;

    await sb.from('case_access_log').insert({
      case_id: params.caseId,
      user_id: userId,
      actor_name: actorName ?? null,
      actor_role: actorRole ?? null,
      context: params.context,
      ip_address: ip || null,
    });
  } catch {
    // Une consultation non journalisée ne doit jamais empêcher la consultation
    // elle-même : un magistrat en pleine alerte ne peut pas être bloqué parce
    // que la table de traçage est indisponible.
  }
}
