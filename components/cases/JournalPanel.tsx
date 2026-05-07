'use client';

import { useActionState } from 'react';
import { BookOpen, Plus, CheckCircle, XCircle, Minus, AlertTriangle } from 'lucide-react';
import { addJournalEntryAction } from '@/app/sigep/dashboard/cases/journal-actions';
import type { JournalEntry, JournalEntryType } from '@/lib/supabase/types';

const TYPE_META: Record<JournalEntryType, { label: string; color: string; bg: string; icon: typeof Plus }> = {
  POSITIVE: { label: 'Positif',  color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', icon: CheckCircle },
  NEUTRAL:  { label: 'Neutre',   color: 'text-gray-600',    bg: 'bg-gray-50 border-gray-200',       icon: Minus },
  NEGATIVE: { label: 'Négatif',  color: 'text-orange-700',  bg: 'bg-orange-50 border-orange-200',   icon: XCircle },
  INCIDENT: { label: 'Incident', color: 'text-red-700',     bg: 'bg-red-50 border-red-200',         icon: AlertTriangle },
};

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Admin',
  STRATEGIC:   'Stratégique',
  JUDGE:       'Juge',
  OPERATIONAL: 'Agent',
};

function formatDT(iso: string) {
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

interface Props {
  caseId: string;
  entries: JournalEntry[];
  canWrite: boolean;
}

export default function JournalPanel({ caseId, entries, canWrite }: Props) {
  const [state, formAction, isPending] = useActionState(addJournalEntryAction, null);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2">
        <BookOpen className="w-4 h-4 text-gray-400" />
        <h3 className="font-semibold text-gray-900">Journal comportemental</h3>
        <span className="ml-auto text-xs text-gray-400">{entries.length} entrée{entries.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Entry form */}
      {canWrite && (
        <div className="px-5 py-4 border-b border-gray-50 bg-gray-50">
          <form action={formAction} className="space-y-3">
            <input type="hidden" name="case_id" value={caseId} />
            {state?.error && (
              <p className="text-xs text-red-600">{state.error}</p>
            )}
            <div className="flex gap-2">
              {(['POSITIVE','NEUTRAL','NEGATIVE','INCIDENT'] as JournalEntryType[]).map((t) => {
                const m = TYPE_META[t];
                const Icon = m.icon;
                return (
                  <label key={t} className="flex-1">
                    <input type="radio" name="entry_type" value={t} className="sr-only peer" required />
                    <span className={`flex flex-col items-center gap-0.5 cursor-pointer rounded-lg px-2 py-2 border text-[10px] font-bold transition-all peer-checked:ring-2 ring-offset-1 ${m.bg} ${m.color} peer-checked:ring-current`}>
                      <Icon className="w-3.5 h-3.5" />
                      {m.label}
                    </span>
                  </label>
                );
              })}
            </div>
            <textarea
              name="content"
              required
              rows={3}
              placeholder="Observation, incident ou compte-rendu de visite…"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none bg-white"
            />
            <button
              type="submit"
              disabled={isPending}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-500 disabled:opacity-50 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              {isPending ? 'Enregistrement…' : 'Ajouter une entrée'}
            </button>
          </form>
        </div>
      )}

      {/* Entries list */}
      {entries.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">Aucune entrée dans le journal</p>
      ) : (
        <ul className="divide-y divide-gray-50">
          {entries.map((entry) => {
            const meta = TYPE_META[entry.entry_type];
            const Icon = meta.icon;
            return (
              <li key={entry.id} className="px-5 py-4">
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 border ${meta.bg}`}>
                    <Icon className={`w-3.5 h-3.5 ${meta.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`text-[10px] font-bold ${meta.color}`}>{meta.label}</span>
                      <span className="text-[10px] text-gray-400">
                        {entry.author_name} ({ROLE_LABELS[entry.author_role] ?? entry.author_role})
                      </span>
                      <span className="text-[10px] text-gray-300">{formatDT(entry.created_at)}</span>
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed">{entry.content}</p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
