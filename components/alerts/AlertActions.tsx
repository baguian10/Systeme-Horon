'use client';

import { useState } from 'react';
import { CheckCircle, Eye, UserPlus } from 'lucide-react';
import { acknowledgeAlertAction, assignAlertAction, resolveAlertAction } from '@/app/sigep/dashboard/alerts/actions';

interface UserOpt { id: string; full_name: string }

const CATEGORIES: { value: string; label: string }[] = [
  { value: 'JUSTIFIED', label: 'Violation avérée (traitée)' },
  { value: 'INTERVENTION', label: 'Intervention effectuée' },
  { value: 'TECHNICAL', label: 'Problème technique' },
  { value: 'FALSE_ALARM', label: 'Fausse alerte' },
];

export default function AlertActions({
  alertId,
  status,
  assignedTo,
  users,
}: {
  alertId: string;
  status: string;
  assignedTo: string | null;
  users: UserOpt[];
}) {
  const [showResolve, setShowResolve] = useState(false);

  return (
    <div className="flex items-center justify-end gap-2">
      {status === 'NEW' && (
        <form action={acknowledgeAlertAction}>
          <input type="hidden" name="alertId" value={alertId} />
          <button type="submit" data-tip="Accuser réception : marque l'alerte comme vue (statut → Vue)" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium">
            <Eye className="w-3.5 h-3.5" /> Vu
          </button>
        </form>
      )}

      <form action={assignAlertAction} className="flex items-center">
        <input type="hidden" name="alertId" value={alertId} />
        <UserPlus className="w-3.5 h-3.5 text-gray-400 mr-1" />
        <select
          name="userId"
          defaultValue={assignedTo ?? ''}
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
          className="text-xs border border-gray-200 rounded-md px-1.5 py-1 max-w-[130px]"
          data-tip="Assigner l'alerte à un agent (statut → En cours)"
        >
          <option value="">Non assignée</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
        </select>
      </form>

      <button
        onClick={() => setShowResolve(true)}
        data-tip="Clôturer l'alerte avec un motif et un compte rendu obligatoires (traçabilité)"
        className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 font-medium"
      >
        <CheckCircle className="w-3.5 h-3.5" /> Clôturer
      </button>

      {showResolve && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowResolve(false)}>
          <div className="bg-white rounded-2xl p-5 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-gray-900 mb-3">Clôturer l&apos;alerte</h3>
            <form action={resolveAlertAction} className="space-y-3">
              <input type="hidden" name="alertId" value={alertId} />
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Motif de clôture *</label>
                <select name="category" defaultValue="JUSTIFIED" className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm">
                  {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Compte rendu * (obligatoire)</label>
                <textarea name="reason" required rows={3} placeholder="Décision prise, action effectuée, justification…" className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm" />
              </div>
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setShowResolve(false)} className="px-3 py-1.5 rounded-lg bg-gray-100 text-sm">Annuler</button>
                <button type="submit" className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold">Clôturer</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
