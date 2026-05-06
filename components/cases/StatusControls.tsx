'use client';

import { updateCaseStatusAction } from '@/app/sigep/dashboard/cases/actions';
import type { CaseStatus } from '@/lib/supabase/types';

interface Transition {
  status: CaseStatus;
  label: string;
  className: string;
  confirmMsg?: string;
}

const TRANSITIONS: Partial<Record<CaseStatus, Transition[]>> = {
  ACTIVE: [
    { status: 'SUSPENDED', label: 'Suspendre', className: 'bg-amber-100 text-amber-700 hover:bg-amber-200' },
    { status: 'TERMINATED', label: 'Clôturer', className: 'bg-red-100 text-red-700 hover:bg-red-200', confirmMsg: 'Confirmer la clôture de ce dossier ? Cette action est irréversible.' },
  ],
  VIOLATION: [
    { status: 'SUSPENDED', label: 'Suspendre', className: 'bg-amber-100 text-amber-700 hover:bg-amber-200' },
    { status: 'TERMINATED', label: 'Clôturer', className: 'bg-red-100 text-red-700 hover:bg-red-200', confirmMsg: 'Confirmer la clôture de ce dossier ? Cette action est irréversible.' },
  ],
  SUSPENDED: [
    { status: 'ACTIVE', label: 'Réactiver', className: 'bg-green-100 text-green-700 hover:bg-green-200' },
    { status: 'TERMINATED', label: 'Clôturer', className: 'bg-red-100 text-red-700 hover:bg-red-200', confirmMsg: 'Confirmer la clôture de ce dossier ? Cette action est irréversible.' },
  ],
  PENDING: [
    { status: 'ACTIVE', label: 'Activer', className: 'bg-green-100 text-green-700 hover:bg-green-200' },
  ],
};

interface Props {
  caseId: string;
  currentStatus: CaseStatus;
}

export default function StatusControls({ caseId, currentStatus }: Props) {
  const transitions = TRANSITIONS[currentStatus] ?? [];
  if (transitions.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      {transitions.map(({ status, label, className, confirmMsg }) => (
        <form
          key={status}
          action={updateCaseStatusAction}
          onSubmit={(e) => {
            if (confirmMsg && !window.confirm(confirmMsg)) e.preventDefault();
          }}
        >
          <input type="hidden" name="case_id" value={caseId} />
          <input type="hidden" name="status" value={status} />
          <button
            type="submit"
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${className}`}
          >
            {label}
          </button>
        </form>
      ))}
    </div>
  );
}
