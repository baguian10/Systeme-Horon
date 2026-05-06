'use client';

import { useTransition, useState } from 'react';
import { UserCheck, UserMinus, UserPlus } from 'lucide-react';
import { assignOperationalAction, removeAssignmentAction } from '@/app/sigep/dashboard/cases/actions';

interface Assigned {
  id: string;
  full_name: string;
  badge_number: string | null;
  assigned_at: string;
}

interface Available {
  id: string;
  full_name: string;
  badge_number: string | null;
}

interface Props {
  caseId: string;
  assigned: Assigned[];
  available: Available[];
  canManage: boolean;
}

export default function AssignmentManager({ caseId, assigned, available, canManage }: Props) {
  const [isPending, startTransition] = useTransition();
  const [showAdd, setShowAdd] = useState(false);
  const [selectedId, setSelectedId] = useState('');

  function handleAssign() {
    if (!selectedId) return;
    const fd = new FormData();
    fd.set('case_id', caseId);
    fd.set('operational_id', selectedId);
    startTransition(async () => {
      await assignOperationalAction(fd);
      setSelectedId('');
      setShowAdd(false);
    });
  }

  function handleRemove(operationalId: string) {
    const fd = new FormData();
    fd.set('case_id', caseId);
    fd.set('operational_id', operationalId);
    startTransition(() => removeAssignmentAction(fd));
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">Agents assignés</h3>
        {canManage && available.length > 0 && (
          <button
            onClick={() => setShowAdd((v) => !v)}
            className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium"
          >
            <UserPlus className="w-3.5 h-3.5" />
            Assigner
          </button>
        )}
      </div>

      {showAdd && (
        <div className="px-5 py-3 bg-blue-50 border-b border-blue-100 flex items-center gap-2">
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="flex-1 text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">— Choisir un agent opérationnel —</option>
            {available.map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name}{u.badge_number ? ` · ${u.badge_number}` : ''}
              </option>
            ))}
          </select>
          <button
            onClick={handleAssign}
            disabled={!selectedId || isPending}
            className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-500 disabled:opacity-50 transition-colors"
          >
            {isPending ? '...' : 'Confirmer'}
          </button>
          <button onClick={() => setShowAdd(false)} className="text-xs text-gray-500 hover:text-gray-700">
            Annuler
          </button>
        </div>
      )}

      {assigned.length === 0 ? (
        <div className="flex items-center gap-2 px-5 py-4 text-sm text-gray-400">
          <UserCheck className="w-4 h-4" /> Aucun agent opérationnel assigné
        </div>
      ) : (
        <ul className="divide-y divide-gray-50">
          {assigned.map((u) => (
            <li key={u.id} className="px-5 py-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-gray-900">{u.full_name}</p>
                <p className="text-xs text-gray-400">
                  {u.badge_number ?? '—'} · assigné le {new Date(u.assigned_at).toLocaleDateString('fr-FR')}
                </p>
              </div>
              {canManage && (
                <button
                  onClick={() => handleRemove(u.id)}
                  disabled={isPending}
                  className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
                >
                  <UserMinus className="w-3.5 h-3.5" />
                  Retirer
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
