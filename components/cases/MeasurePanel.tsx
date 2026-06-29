'use client';

import { useState } from 'react';
import { Scale, FileText, CalendarPlus, FlagOff } from 'lucide-react';
import { amendMeasureAction } from '@/app/sigep/dashboard/cases/actions';

const MEASURE_LABELS: Record<string, string> = {
  DEAS: 'Détention à domicile (DEAS)',
  PSE: 'Surveillance électronique (PSE)',
  PLACEMENT_EXTERIEUR: 'Placement extérieur',
  CONTROLE_JUDICIAIRE: 'Contrôle judiciaire',
  TIG: "Travail d'intérêt général",
  SEMI_LIBERTE: 'Semi-liberté',
};

interface Props {
  caseId: string;
  measureType?: string | null;
  legalBasis?: string | null;
  ordonnanceRef?: string | null;
  ordonnanceUrl?: string | null;
  obligations?: string | null;
  endDate?: string | null;
  canAmend: boolean;
  terminated: boolean;
}

export default function MeasurePanel(p: Props) {
  const [showExtend, setShowExtend] = useState(false);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2">
        <Scale className="w-4 h-4 text-indigo-500" />
        <h3 className="font-semibold text-gray-900">Mesure judiciaire</h3>
      </div>
      <div className="px-5 py-4 space-y-2 text-sm">
        <Row label="Type" value={p.measureType ? (MEASURE_LABELS[p.measureType] ?? p.measureType) : '—'} />
        <Row label="Base légale" value={p.legalBasis ?? '—'} />
        <Row label="Ordonnance" value={p.ordonnanceRef ?? '—'} />
        {p.ordonnanceUrl && (
          <a href={p.ordonnanceUrl} target="_blank" rel="noreferrer" data-tip="Ouvrir l'ordonnance / pièce judiciaire jointe" className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:underline">
            <FileText className="w-3.5 h-3.5" /> Voir la pièce
          </a>
        )}
        {p.obligations && (
          <div className="pt-1">
            <p className="text-[11px] text-gray-400 mb-0.5">Obligations</p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{p.obligations}</p>
          </div>
        )}
        {p.endDate && <Row label="Fin de mesure" value={new Date(p.endDate).toLocaleDateString('fr-FR')} />}

        {p.canAmend && !p.terminated && (
          <div className="pt-3 border-t border-gray-50 flex flex-wrap gap-2">
            {!showExtend ? (
              <button onClick={() => setShowExtend(true)} data-tip="Prolonger la mesure : repousser la date de fin" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-xs font-semibold hover:bg-blue-100">
                <CalendarPlus className="w-3.5 h-3.5" /> Prolonger
              </button>
            ) : (
              <form action={amendMeasureAction} className="flex items-center gap-2">
                <input type="hidden" name="case_id" value={p.caseId} />
                <input type="hidden" name="kind" value="EXTEND" />
                <input type="date" name="end_date" required className="border border-gray-300 rounded-lg px-2 py-1 text-xs" />
                <button type="submit" data-tip="Valider la nouvelle date de fin de mesure" className="px-2.5 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold">OK</button>
                <button type="button" onClick={() => setShowExtend(false)} className="text-xs text-gray-400">Annuler</button>
              </form>
            )}
            <form action={amendMeasureAction} onSubmit={(e) => { if (!confirm('Prononcer la mainlevée (fin de la mesure) ?')) e.preventDefault(); }}>
              <input type="hidden" name="case_id" value={p.caseId} />
              <input type="hidden" name="kind" value="LIFT" />
              <button type="submit" data-tip="Mainlevée : mettre fin à la mesure de façon anticipée (≠ révocation/sanction)" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 text-xs font-semibold hover:bg-amber-100">
                <FlagOff className="w-3.5 h-3.5" /> Mainlevée
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-gray-400">{label}</span>
      <span className="text-sm text-gray-800 text-right">{value}</span>
    </div>
  );
}
