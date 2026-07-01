import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Inbox, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { getSession } from '@/lib/auth/session';
import { canViewCaseRequests, canDecideCaseRequest } from '@/lib/auth/permissions';
import { fetchCaseRequests } from '@/lib/mock/helpers';
import { decideCaseRequestAction } from '../cases/request-actions';
import type { CaseRequestType, CaseRequestStatus } from '@/lib/supabase/types';

export const metadata = { title: 'Requêtes — SIGEP' };
export const revalidate = 0;

const TYPE_LABEL: Record<CaseRequestType, string> = {
  DELETE: 'Suppression du dossier',
  ARCHIVE: 'Archivage',
  REACTIVATE: 'Réactivation',
  EXTEND: 'Prolongation de mesure',
  MODIFY_CONDITIONS: 'Modification des conditions',
  TRANSFER_JURISDICTION: 'Transfert de juridiction',
};

const STATUS_META: Record<CaseRequestStatus, { label: string; cls: string }> = {
  PENDING:  { label: 'En attente', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  APPROVED: { label: 'Approuvée',  cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  REJECTED: { label: 'Rejetée',    cls: 'bg-red-50 text-red-700 border-red-200' },
};

function fmt(iso: string) {
  return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default async function RequetesPage() {
  const session = await getSession();
  if (!session || !canViewCaseRequests(session.role)) redirect('/sigep/dashboard');

  const canDecide = canDecideCaseRequest(session.role);
  const requests = await fetchCaseRequests(session.role);
  const pending = requests.filter((r) => r.status === 'PENDING');
  const decided = requests.filter((r) => r.status !== 'PENDING');

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Requêtes institutionnelles</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          {canDecide
            ? 'Demandes des juges à valider (suppression, archivage, réactivation, transfert…).'
            : 'Vos demandes soumises au Super Administrateur et leur décision.'}
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2">
          <Inbox className="w-4 h-4 text-gray-400" />
          <h3 className="font-semibold text-gray-900 text-sm">En attente ({pending.length})</h3>
        </div>
        {pending.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-10">Aucune requête en attente.</p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {pending.map((r) => (
              <li key={r.id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-gray-900">{TYPE_LABEL[r.request_type]}</span>
                      <Link href={`/sigep/dashboard/cases/${r.case_id}`} className="text-xs font-mono text-blue-600 hover:underline">
                        {r.case_number}
                      </Link>
                      <span className="text-[11px] text-gray-400">· {r.individual_name}</span>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">{r.reason}</p>
                    <p className="text-[10px] text-gray-400 mt-1 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Demandé par {r.requested_by_name} · {fmt(r.created_at)}
                    </p>
                  </div>
                  {canDecide && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <form action={decideCaseRequestAction}>
                        <input type="hidden" name="request_id" value={r.id} />
                        <input type="hidden" name="decision" value="APPROVED" />
                        <button type="submit" className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5 hover:bg-emerald-100">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Approuver
                        </button>
                      </form>
                      <form action={decideCaseRequestAction}>
                        <input type="hidden" name="request_id" value={r.id} />
                        <input type="hidden" name="decision" value="REJECTED" />
                        <button type="submit" className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-100">
                          <XCircle className="w-3.5 h-3.5" /> Rejeter
                        </button>
                      </form>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {decided.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50">
            <h3 className="font-semibold text-gray-600 text-sm">Décidées ({decided.length})</h3>
          </div>
          <ul className="divide-y divide-gray-50">
            {decided.map((r) => {
              const meta = STATUS_META[r.status];
              return (
                <li key={r.id} className="px-5 py-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm text-gray-800">{TYPE_LABEL[r.request_type]}</span>
                      <span className="text-xs font-mono text-gray-500">{r.case_number}</span>
                    </div>
                    <p className="text-xs text-gray-500 truncate">{r.reason}</p>
                    {r.decision_note && <p className="text-[10px] text-gray-400 mt-0.5">Note : {r.decision_note}</p>}
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0 ${meta.cls}`}>{meta.label}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
