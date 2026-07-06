'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Route, FileText, MapPin } from 'lucide-react';
import type { ItineraryCaseOption } from './ItineraryExplorer';

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

// Rapports entry point for the daily itinerary / history: pick a case + day,
// then either open the interactive replay (in the dossier) or the printable
// PDF served by /api/track/history/report.
export default function DailyReportPicker({ cases }: { cases: ItineraryCaseOption[] }) {
  const [caseId, setCaseId] = useState(cases[0]?.id ?? '');
  const [date, setDate] = useState(todayUTC());

  const disabled = !caseId || !date;

  return (
    <div className="bg-white rounded-2xl border border-violet-100 p-5 flex flex-col gap-4">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-violet-100 text-violet-700">
          <Route className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 text-sm leading-tight">Historique journalier (itinéraire)</h3>
          <p className="text-xs text-gray-500 mt-1 leading-relaxed">
            Trajet GPS d&apos;une journée : déplacements, arrêts, entrées/sorties de zones et respect du couvre-feu — pour l&apos;audience.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <select
          value={caseId}
          onChange={(e) => setCaseId(e.target.value)}
          className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-violet-500"
        >
          {cases.length === 0 && <option value="">Aucun dossier</option>}
          {cases.map((c) => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>
        <input
          type="date"
          value={date}
          max={todayUTC()}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
      </div>

      <div className="flex gap-2 pt-1 border-t border-gray-50">
        <Link
          href={disabled ? '#' : `/sigep/dashboard/cases/${caseId}/history`}
          aria-disabled={disabled}
          className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
            disabled ? 'bg-gray-100 text-gray-400 pointer-events-none' : 'bg-violet-600 hover:bg-violet-500 text-white'
          }`}
        >
          <MapPin className="w-3.5 h-3.5" />
          Voir l&apos;itinéraire
        </Link>
        <a
          href={disabled ? undefined : `/api/track/history/report?caseId=${encodeURIComponent(caseId)}&date=${date}`}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-colors ${
            disabled ? 'border-gray-100 text-gray-300 pointer-events-none' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          PDF du jour
        </a>
      </div>
    </div>
  );
}
