'use client';

import { useState } from 'react';
import { Route } from 'lucide-react';
import HistoryReplay from './HistoryReplay';

export interface ItineraryCaseOption {
  id: string;
  label: string;
}

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

// Global itinerary / daily-history browser: pick any readable case, then reuse
// the same day-replay used inside a dossier. Keyed by caseId so switching case
// resets the replay (playhead, selected day) cleanly.
export default function ItineraryExplorer({
  cases,
  initialCaseId,
}: {
  cases: ItineraryCaseOption[];
  initialCaseId?: string;
}) {
  const [caseId, setCaseId] = useState(initialCaseId ?? cases[0]?.id ?? '');

  if (cases.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white px-4 py-12 text-center text-sm text-gray-400">
        Aucun dossier consultable pour l&apos;historique.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Route className="w-4 h-4 text-violet-600" />
        <label htmlFor="itinerary-case" className="text-sm font-medium text-gray-600">
          Dossier :
        </label>
        <select
          id="itinerary-case"
          value={caseId}
          onChange={(e) => setCaseId(e.target.value)}
          className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
        >
          {cases.map((c) => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>
      </div>

      {caseId && <HistoryReplay key={caseId} caseId={caseId} initialDate={todayUTC()} />}
    </div>
  );
}
