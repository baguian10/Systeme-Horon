'use client';

import { useState, useTransition } from 'react';
import { ArrowLeftRight } from 'lucide-react';
import { transferJudgeCasesAction } from '@/app/sigep/dashboard/users/actions';

type JudgeOpt = { id: string; full_name: string };

export default function TransferCasesButton({
  fromJudge, fromName, caseCount, judges,
}: { fromJudge: string; fromName: string; caseCount: number; judges: JudgeOpt[] }) {
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const targets = judges.filter((j) => j.id !== fromJudge);

  function submit() {
    if (!to) { setError('Choisissez un juge destinataire.'); return; }
    if (!confirm(`Transférer les ${caseCount} dossier(s) de ${fromName} au juge sélectionné ?`)) return;
    const fd = new FormData();
    fd.set('from_judge', fromJudge);
    fd.set('to_judge', to);
    startTransition(async () => {
      const res = await transferJudgeCasesAction(fd);
      if (res?.error) { setError(res.error); return; }
      setOpen(false); setError(null);
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg text-blue-700 bg-blue-50 hover:bg-blue-100"
        data-tip="Réassigner tous les dossiers de ce juge à un autre juge (requis avant suppression)"
      >
        <ArrowLeftRight className="w-3.5 h-3.5" /> Transférer ({caseCount})
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap justify-end">
      <select value={to} onChange={(e) => { setTo(e.target.value); setError(null); }} className="border border-gray-200 rounded-lg px-2 py-1 text-xs">
        <option value="">— Juge destinataire —</option>
        {targets.map((j) => <option key={j.id} value={j.id}>{j.full_name}</option>)}
      </select>
      <button onClick={submit} disabled={pending} className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-blue-600 text-white disabled:opacity-50 hover:bg-blue-500">
        {pending ? '…' : 'Confirmer'}
      </button>
      <button onClick={() => { setOpen(false); setError(null); }} className="text-xs text-gray-500 px-2 py-1">Annuler</button>
      {error && <span className="text-[10px] text-red-600 w-full text-right">{error}</span>}
    </div>
  );
}
