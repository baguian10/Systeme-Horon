import { redirect } from 'next/navigation';
import { AlertTriangle, CheckCircle2, XCircle, Clock, FileText, User, ChevronRight } from 'lucide-react';
import { getSession } from '@/lib/auth/session';
import { canViewRevocations, canManageRevocations } from '@/lib/auth/permissions';
import { fetchRevocations } from '@/lib/mock/helpers';
import { decideRevocationAction } from './actions';
import type { RevocationStatus } from '@/lib/supabase/types';

export const metadata = { title: 'Procédures de révocation — SIGEP' };
export const revalidate = 0;

const STATUS_META: Record<RevocationStatus, { label: string; color: string; bg: string; icon: typeof Clock }> = {
  PENDING:      { label: 'En attente',      color: 'text-amber-700',   bg: 'bg-amber-50 border-amber-200',   icon: Clock },
  UNDER_REVIEW: { label: 'En instruction',  color: 'text-blue-700',    bg: 'bg-blue-50 border-blue-200',     icon: FileText },
  APPROVED:     { label: 'Révocation prononcée', color: 'text-red-700',  bg: 'bg-red-50 border-red-200',    icon: XCircle },
  REJECTED:     { label: 'Rejetée',         color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', icon: CheckCircle2 },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
}

export default async function RevocationsPage() {
  const session = await getSession();
  if (!session || !canViewRevocations(session.role)) redirect('/sigep/dashboard');

  const canDecide = canManageRevocations(session.role);
  const revocations = await fetchRevocations(session.role, session.id);

  const pending      = revocations.filter((r) => r.status === 'PENDING');
  const underReview  = revocations.filter((r) => r.status === 'UNDER_REVIEW');
  const decided      = revocations.filter((r) => r.status === 'APPROVED' || r.status === 'REJECTED');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Procédures de révocation</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Demandes de révocation du TIG et conversion en peine d&apos;emprisonnement
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'En attente',      value: pending.length,     color: 'text-amber-600',   bg: 'bg-amber-50 border-amber-100' },
          { label: 'En instruction',  value: underReview.length, color: 'text-blue-600',    bg: 'bg-blue-50 border-blue-100' },
          { label: 'Approuvées',      value: revocations.filter((r) => r.status === 'APPROVED').length, color: 'text-red-600',     bg: 'bg-red-50 border-red-100' },
          { label: 'Rejetées',        value: revocations.filter((r) => r.status === 'REJECTED').length, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-100' },
        ].map((k) => (
          <div key={k.label} className={`border rounded-2xl p-4 ${k.bg}`}>
            <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Legal notice */}
      <div className="bg-red-50 border border-red-200 rounded-2xl px-5 py-4 flex items-start gap-3">
        <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-red-800">Procédure de révocation — Article 28 du Code Pénal</p>
          <p className="text-xs text-red-700 mt-0.5 leading-relaxed">
            En cas de violation grave ou répétée des obligations TIG, le juge peut prononcer la révocation et ordonner
            l&apos;exécution de la peine d&apos;emprisonnement initialement prononcée. Toute décision doit être motivée
            et notifiée à l&apos;intéressé dans un délai de 48 heures.
          </p>
        </div>
      </div>

      {/* Pending + Under review */}
      {(pending.length > 0 || underReview.length > 0) && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50">
            <h3 className="font-semibold text-gray-900 text-sm">Demandes en cours ({pending.length + underReview.length})</h3>
          </div>
          <ul className="divide-y divide-gray-50">
            {[...pending, ...underReview].map((rev) => {
              const meta = STATUS_META[rev.status];
              const StatusIcon = meta.icon;
              return (
                <li key={rev.id} className="px-5 py-5">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${meta.bg} ${meta.color}`}>
                          <StatusIcon className="w-3 h-3" /> {meta.label}
                        </span>
                        <span className="text-xs font-mono text-gray-500">{rev.case_number}</span>
                        <span className="text-xs text-gray-400">{formatDate(rev.created_at)}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-sm text-gray-700 font-medium">
                        <User className="w-3.5 h-3.5 text-gray-400" />
                        {rev.individual_name}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Demandé par {rev.requested_by_name} · {rev.violation_count} violation{rev.violation_count > 1 ? 's' : ''} signalée{rev.violation_count > 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-xl px-4 py-3 mb-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Motif de la demande</p>
                    <p className="text-sm text-gray-700 leading-relaxed">{rev.reason}</p>
                  </div>

                  {canDecide && (
                    <div className="flex items-center gap-3">
                      <form action={decideRevocationAction}>
                        <input type="hidden" name="revocation_id" value={rev.id} />
                        <input type="hidden" name="decision" value="APPROVED" />
                        <button
                          type="submit"
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-semibold hover:bg-red-500 transition-colors"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          Prononcer la révocation
                        </button>
                      </form>
                      <form action={decideRevocationAction}>
                        <input type="hidden" name="revocation_id" value={rev.id} />
                        <input type="hidden" name="decision" value="REJECTED" />
                        <button
                          type="submit"
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-500 transition-colors"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Rejeter — mise en garde
                        </button>
                      </form>
                      {rev.status === 'PENDING' && (
                        <form action={decideRevocationAction}>
                          <input type="hidden" name="revocation_id" value={rev.id} />
                          <input type="hidden" name="decision" value="UNDER_REVIEW" />
                          <button
                            type="submit"
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-blue-300 text-blue-700 text-xs font-semibold hover:bg-blue-50 transition-colors"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            Mettre en instruction
                          </button>
                        </form>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Decided cases */}
      {decided.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50">
            <h3 className="font-semibold text-gray-500 text-sm">Historique des décisions ({decided.length})</h3>
          </div>
          <ul className="divide-y divide-gray-50">
            {decided.map((rev) => {
              const meta = STATUS_META[rev.status];
              const StatusIcon = meta.icon;
              return (
                <li key={rev.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${meta.bg} ${meta.color}`}>
                          <StatusIcon className="w-3 h-3" /> {meta.label}
                        </span>
                        <span className="text-xs font-mono text-gray-500">{rev.case_number}</span>
                      </div>
                      <p className="text-sm font-medium text-gray-800">{rev.individual_name}</p>
                      {rev.judge_decision && (
                        <p className="text-xs text-gray-500 mt-1 italic">&quot;{rev.judge_decision}&quot;</p>
                      )}
                    </div>
                    {rev.decided_at && (
                      <span className="text-xs text-gray-400 flex-shrink-0 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        {formatDate(rev.decided_at)}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {revocations.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 px-5 py-16 text-center">
          <CheckCircle2 className="w-10 h-10 text-emerald-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">Aucune procédure de révocation en cours</p>
        </div>
      )}
    </div>
  );
}
