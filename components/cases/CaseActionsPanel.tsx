'use client';

import { useActionState, useState } from 'react';
import { Gavel, Archive, RotateCcw, Trash2, Send, CheckCircle2 } from 'lucide-react';
import {
  submitCaseRequestAction, archiveCaseAction, reactivateCaseAction, deleteCaseAction,
} from '@/app/sigep/dashboard/cases/request-actions';
import type { CaseStatus, CaseRequestType } from '@/lib/supabase/types';

const REQUEST_OPTIONS: { value: CaseRequestType; label: string }[] = [
  { value: 'ARCHIVE',    label: 'Archiver le dossier' },
  { value: 'REACTIVATE', label: 'Réactiver le dossier' },
  { value: 'EXTEND',     label: 'Prolonger la mesure' },
  { value: 'TRANSFER_JURISDICTION', label: 'Transférer de juridiction' },
  { value: 'DELETE',     label: 'Supprimer le dossier' },
];

const IN = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500';

type Dept = { id: string; name: string };

export default function CaseActionsPanel({
  caseId, status, isJudge, isSuperAdmin, departments = [],
}: { caseId: string; status: CaseStatus; isJudge: boolean; isSuperAdmin: boolean; departments?: Dept[] }) {
  const [state, action, pending] = useActionState(submitCaseRequestAction, null);
  const [reqType, setReqType] = useState<CaseRequestType | ''>('');
  const closed = status === 'TERMINATED' || status === 'ARCHIVED';

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
      <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
        <Gavel className="w-4 h-4 text-purple-600" /> Actions institutionnelles
      </h3>

      {/* JUDGE: submit a request to the super admin */}
      {isJudge && (
        <form action={action} className="space-y-2.5">
          <p className="text-xs text-gray-500">Soumettre une requête au Super Administrateur.</p>
          <input type="hidden" name="case_id" value={caseId} />
          <select name="request_type" required value={reqType} onChange={(e) => setReqType(e.target.value as CaseRequestType)} className={IN}>
            <option value="" disabled>— Type de requête —</option>
            {REQUEST_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>

          {/* EXTEND → new end date */}
          {reqType === 'EXTEND' && (
            <div>
              <label className="block text-[11px] text-gray-500 mb-1">Nouvelle date de fin de mesure</label>
              <input type="date" name="end_date" required className={IN} />
            </div>
          )}

          {/* TRANSFER → destination jurisdiction */}
          {reqType === 'TRANSFER_JURISDICTION' && (
            <div>
              <label className="block text-[11px] text-gray-500 mb-1">Juridiction destinataire</label>
              <select name="department_id" required defaultValue="" className={IN}>
                <option value="" disabled>— Choisir une entité —</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          )}

          <textarea name="reason" rows={2} required placeholder="Motif de la requête (obligatoire)…" className={IN} />
          {state?.error && <p className="text-xs text-red-600">{state.error}</p>}
          {state?.ok && <p className="text-xs text-emerald-600 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Requête soumise.</p>}
          <button type="submit" disabled={pending} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-purple-600 text-white text-xs font-semibold disabled:opacity-50 hover:bg-purple-500">
            <Send className="w-3.5 h-3.5" /> {pending ? 'Envoi…' : 'Soumettre la requête'}
          </button>
        </form>
      )}

      {/* SUPER_ADMIN: direct acts */}
      {isSuperAdmin && (
        <div className="flex flex-wrap gap-2">
          {status === 'TERMINATED' && (
            <form action={archiveCaseAction}>
              <input type="hidden" name="case_id" value={caseId} />
              <button type="submit" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 hover:bg-slate-200">
                <Archive className="w-3.5 h-3.5" /> Archiver
              </button>
            </form>
          )}
          {closed && (
            <form action={reactivateCaseAction}>
              <input type="hidden" name="case_id" value={caseId} />
              <button type="submit" className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 hover:bg-emerald-100">
                <RotateCcw className="w-3.5 h-3.5" /> Réactiver
              </button>
            </form>
          )}
          {closed && (
            <form action={deleteCaseAction}>
              <input type="hidden" name="case_id" value={caseId} />
              <button
                type="submit"
                data-confirm="Supprimer définitivement ce dossier et toutes ses données (positions, alertes, géofences) ? Action irréversible."
                onClick={(e) => { if (!confirm(e.currentTarget.getAttribute('data-confirm')!)) e.preventDefault(); }}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 hover:bg-red-100"
              >
                <Trash2 className="w-3.5 h-3.5" /> Supprimer
              </button>
            </form>
          )}
          {!closed && (
            <p className="text-[11px] text-gray-400">Le dossier doit être clôturé (ou archivé) avant archivage/suppression.</p>
          )}
        </div>
      )}
    </div>
  );
}
