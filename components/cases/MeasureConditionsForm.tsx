'use client';

import { useActionState, useState } from 'react';
import { SlidersHorizontal, CheckCircle2 } from 'lucide-react';
import { setMeasureConditionsAction } from '@/app/sigep/dashboard/cases/request-actions';
import type { MeasureKind } from '@/lib/supabase/types';

const KINDS: { value: MeasureKind; label: string }[] = [
  { value: 'ASSIGNATION_DOMICILE', label: 'Assignation à domicile' },
  { value: 'DETENTION_DOMICILE',   label: 'Détention à domicile' },
  { value: 'TIG',                  label: "Travail d'intérêt général" },
  { value: 'COUVRE_FEU',           label: 'Couvre-feu' },
  { value: 'INTERDICTION_ZONE',    label: 'Interdiction de zone' },
  { value: 'LIBERTE_SURVEILLEE',   label: 'Liberté surveillée' },
];
const DAYS = [
  { v: 1, l: 'Lun' }, { v: 2, l: 'Mar' }, { v: 3, l: 'Mer' }, { v: 4, l: 'Jeu' },
  { v: 5, l: 'Ven' }, { v: 6, l: 'Sam' }, { v: 0, l: 'Dim' },
];

const IN = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500';

type Initial = {
  measure_kind?: MeasureKind | null;
  is_permanent?: boolean;
  end_date?: string | null;
  curfew_days?: number[] | null;
  curfew_start?: string | null;
  curfew_end?: string | null;
  obligations?: string | null;
};

export default function MeasureConditionsForm({ caseId, initial, canEdit }: { caseId: string; initial: Initial; canEdit: boolean }) {
  const [state, action, pending] = useActionState(setMeasureConditionsAction, null);
  const [permanent, setPermanent] = useState(Boolean(initial.is_permanent));

  const time = (t?: string | null) => (t ? t.slice(0, 5) : '');

  if (!canEdit) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2"><SlidersHorizontal className="w-4 h-4 text-gray-400" /> Conditions de la mesure</h3>
        <dl className="text-xs text-gray-600 space-y-1.5">
          <div className="flex justify-between"><dt className="text-gray-400">Type</dt><dd>{KINDS.find((k) => k.value === initial.measure_kind)?.label ?? '—'}</dd></div>
          <div className="flex justify-between"><dt className="text-gray-400">Durée</dt><dd>{initial.is_permanent ? 'Permanente' : (initial.end_date ? `Jusqu'au ${new Date(initial.end_date).toLocaleDateString('fr-FR')}` : '—')}</dd></div>
          <div className="flex justify-between"><dt className="text-gray-400">Couvre-feu</dt><dd>{initial.curfew_start ? `${time(initial.curfew_start)}–${time(initial.curfew_end)}` : '—'}</dd></div>
        </dl>
      </div>
    );
  }

  return (
    <form action={action} className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
      <input type="hidden" name="case_id" value={caseId} />
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2"><SlidersHorizontal className="w-4 h-4 text-emerald-600" /> Conditions de la mesure</h3>
        {state?.ok && <span className="inline-flex items-center gap-1 text-xs text-emerald-600"><CheckCircle2 className="w-3.5 h-3.5" /> Enregistré</span>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Type de mesure</label>
          <select name="measure_kind" defaultValue={initial.measure_kind ?? ''} className={IN}>
            <option value="">— Non défini —</option>
            {KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Durée</label>
          <div className="flex items-center gap-3 h-[38px]">
            <label className="flex items-center gap-1.5 text-sm text-gray-700">
              <input type="checkbox" name="is_permanent" value="true" checked={permanent} onChange={(e) => setPermanent(e.target.checked)} />
              Permanente
            </label>
            {!permanent && (
              <input type="date" name="end_date" defaultValue={initial.end_date ? initial.end_date.slice(0, 10) : ''} className={`${IN} flex-1`} />
            )}
          </div>
        </div>
      </div>

      <div>
        <label className="block text-xs text-gray-500 mb-1.5">Couvre-feu — jours concernés</label>
        <div className="flex flex-wrap gap-1.5">
          {DAYS.map((d) => (
            <label key={d.v} className="inline-flex items-center gap-1 text-xs border border-gray-200 rounded-lg px-2 py-1 cursor-pointer has-[:checked]:bg-emerald-50 has-[:checked]:border-emerald-300">
              <input type="checkbox" name="curfew_days" value={d.v} defaultChecked={initial.curfew_days?.includes(d.v)} />
              {d.l}
            </label>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3 mt-2">
          <div>
            <label className="block text-[10px] text-gray-400 mb-1">Début</label>
            <input type="time" name="curfew_start" defaultValue={time(initial.curfew_start)} className={IN} />
          </div>
          <div>
            <label className="block text-[10px] text-gray-400 mb-1">Fin</label>
            <input type="time" name="curfew_end" defaultValue={time(initial.curfew_end)} className={IN} />
          </div>
        </div>
      </div>

      <div>
        <label className="block text-xs text-gray-500 mb-1">Obligations (texte libre)</label>
        <textarea name="obligations" rows={2} defaultValue={initial.obligations ?? ''} placeholder="Ex : présence au site TIG lun–ven, domicile 20h–06h…" className={IN} />
      </div>

      {state?.error && <p className="text-xs text-red-600">{state.error}</p>}
      <button type="submit" disabled={pending} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold disabled:opacity-50">
        {pending ? 'Enregistrement…' : 'Enregistrer les conditions'}
      </button>
    </form>
  );
}
