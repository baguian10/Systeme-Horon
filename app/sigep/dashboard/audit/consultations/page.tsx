import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Eye, ShieldCheck } from 'lucide-react';
import { getSession } from '@/lib/auth/session';
import { canViewUsers, allow } from '@/lib/auth/permissions';

export const metadata = { title: 'Journal des consultations — SIGEP' };
export const revalidate = 0;

const CONTEXT_LABEL: Record<string, { txt: string; cls: string }> = {
  DOSSIER:  { txt: 'Dossier ouvert',   cls: 'bg-blue-100 text-blue-700' },
  SUIVI:    { txt: 'Fiche de suivi',   cls: 'bg-cyan-100 text-cyan-700' },
  INCIDENT: { txt: 'Panneau incident', cls: 'bg-amber-100 text-amber-700' },
  TRAJET:   { txt: 'Trajet consulté',  cls: 'bg-violet-100 text-violet-700' },
  EXPORT:   { txt: 'Export',           cls: 'bg-red-100 text-red-700' },
};

interface Row {
  id: number; case_id: string; actor_name: string | null; actor_role: string | null;
  context: string; viewed_at: string; ip_address: string | null;
  case_number: string | null; person: string | null;
}

export default async function ConsultationsPage({
  searchParams,
}: {
  searchParams: Promise<{ dossier?: string; agent?: string }>;
}) {
  const session = await getSession();
  if (!session || !allow(session, canViewUsers(session.role), 'audit')) redirect('/sigep/dashboard');
  const { dossier, agent } = await searchParams;

  const isDemo = !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  let rows: Row[] = [];
  let unavailable = false;

  if (!isDemo) {
    const { createAdminClient } = await import('@/lib/supabase/admin');
    const sb = createAdminClient();
    if (!sb) unavailable = true;
    else {
      let q = sb
        .from('case_access_log')
        .select('id, case_id, actor_name, actor_role, context, viewed_at, ip_address, case:cases(case_number, individual:individuals(full_name))')
        .order('viewed_at', { ascending: false })
        .limit(300);
      if (dossier) q = q.eq('case_id', dossier);
      if (agent) q = q.ilike('actor_name', `%${agent}%`);
      const { data, error } = await q;
      // Journal indisponible : le dire, jamais afficher un journal vide qui
      // laisserait croire que personne n'a consulté.
      if (error) unavailable = true;
      else rows = (data ?? []).map((r) => {
        const c = r.case as unknown as { case_number?: string; individual?: { full_name?: string } | null } | null;
        return {
          id: r.id as number,
          case_id: r.case_id as string,
          actor_name: r.actor_name as string | null,
          actor_role: r.actor_role as string | null,
          context: r.context as string,
          viewed_at: r.viewed_at as string,
          ip_address: (r.ip_address as string | null) ?? null,
          case_number: c?.case_number ?? null,
          person: c?.individual?.full_name ?? null,
        };
      });
    }
  }

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString('fr-FR', {
      timeZone: 'Africa/Ouagadougou', day: '2-digit', month: '2-digit', year: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });

  return (
    <div className="space-y-5">
      <div>
        <Link href="/sigep/dashboard/audit" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-1">
          <ArrowLeft className="w-4 h-4" /> Retour au journal d&apos;audit
        </Link>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Journal des consultations</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Qui a regardé quel dossier, et quand · accès SUPER_ADMIN uniquement
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-400 bg-white border border-gray-100 rounded-lg px-3 py-2">
            <ShieldCheck className="w-3.5 h-3.5" /> Lecture seule
          </div>
        </div>
      </div>

      {(dossier || agent) && (
        <div className="flex items-center gap-2 text-xs bg-blue-50/60 border border-blue-100 text-blue-800 rounded-xl px-3 py-2">
          Filtre actif : {dossier ? `dossier ${dossier.slice(0, 8)}` : `agent « ${agent} »`}
          <Link href="/sigep/dashboard/audit/consultations" className="font-semibold hover:underline">Tout afficher</Link>
        </div>
      )}

      {unavailable ? (
        <div className="bg-white rounded-2xl border border-amber-100 p-6 text-sm text-amber-700">
          Journal indisponible — la table <span className="font-mono">case_access_log</span> n&apos;est pas encore créée.
          Appliquez la migration <span className="font-mono">20260820030000_case_access_log.sql</span>.
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-sm text-gray-400">
          Aucune consultation enregistrée{dossier || agent ? ' pour ce filtre' : ' pour le moment'}.
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs">
                <tr>
                  <th className="text-left font-medium px-4 py-2.5">Quand</th>
                  <th className="text-left font-medium px-4 py-2.5">Qui</th>
                  <th className="text-left font-medium px-4 py-2.5">Dossier</th>
                  <th className="text-left font-medium px-4 py-2.5">Contexte</th>
                  <th className="text-left font-medium px-4 py-2.5">Adresse</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.map((r) => {
                  const ctx = CONTEXT_LABEL[r.context] ?? { txt: r.context, cls: 'bg-gray-100 text-gray-600' };
                  return (
                    <tr key={r.id} className="hover:bg-gray-50/60">
                      <td className="px-4 py-2.5 whitespace-nowrap text-gray-600">{fmt(r.viewed_at)}</td>
                      <td className="px-4 py-2.5">
                        <Link
                          href={`/sigep/dashboard/audit/consultations?agent=${encodeURIComponent(r.actor_name ?? '')}`}
                          className="font-medium text-gray-800 hover:text-blue-600"
                        >
                          {r.actor_name ?? 'Compte supprimé'}
                        </Link>
                        {r.actor_role && <span className="block text-[10px] text-gray-400">{r.actor_role}</span>}
                      </td>
                      <td className="px-4 py-2.5">
                        <Link href={`/sigep/dashboard/cases/${r.case_id}`} className="text-gray-800 hover:text-blue-600">
                          {r.case_number ?? r.case_id.slice(0, 8)}
                        </Link>
                        {r.person && <span className="block text-[10px] text-gray-400">{r.person}</span>}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${ctx.cls}`}>{ctx.txt}</span>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-[11px] text-gray-400">{r.ip_address ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2.5 border-t border-gray-50 text-[11px] text-gray-400 flex items-center gap-1.5">
            <Eye className="w-3.5 h-3.5" />
            {rows.length} consultation{rows.length > 1 ? 's' : ''} · consultations répétées d&apos;un même dossier regroupées par quart d&apos;heure
          </div>
        </div>
      )}
    </div>
  );
}
