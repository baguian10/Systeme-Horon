'use client';

import { setRiskLevelAction } from '@/app/sigep/dashboard/cases/actions';
import type { RiskLevel } from '@/lib/supabase/types';

const OPTS: { value: RiskLevel; label: string }[] = [
  { value: 'LOW', label: 'Faible' },
  { value: 'MEDIUM', label: 'Moyen' },
  { value: 'HIGH', label: 'Élevé (suivi intensif)' },
];

export default function RiskControl({ caseId, value }: { caseId: string; value?: RiskLevel | null }) {
  return (
    <form action={setRiskLevelAction} className="flex items-center gap-2">
      <input type="hidden" name="case_id" value={caseId} />
      <label className="text-xs text-gray-500">Niveau de risque</label>
      <select
        name="risk_level"
        defaultValue={value ?? 'MEDIUM'}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        data-tip="Niveau de risque du dossier. « Élevé » bascule automatiquement le bracelet en suivi temps réel intensif."
        className="text-sm border border-gray-300 rounded-lg px-2 py-1.5"
      >
        {OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </form>
  );
}
