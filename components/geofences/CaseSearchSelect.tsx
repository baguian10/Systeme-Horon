'use client';

import { useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';

interface CaseHit { id: string; caseNumber: string; name: string }

// Searchable case/person picker — server-side search, scales to 1000+ records.
export default function CaseSearchSelect({
  value,
  onChange,
  selectedLabel,
  onSelectedLabel,
}: {
  value: string;
  onChange: (caseId: string) => void;
  selectedLabel: string;
  onSelectedLabel: (label: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<CaseHit[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Conditional reset when the query is cleared — not a render cascade.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!query.trim()) { setHits([]); return; }
    setLoading(true);
    const t = setTimeout(() => {
      fetch(`/api/cases/search?q=${encodeURIComponent(query.trim())}`, { cache: 'no-store' })
        .then((r) => r.json())
        .then((d) => setHits(Array.isArray(d.cases) ? d.cases : []))
        .catch(() => setHits([]))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  function pick(h: CaseHit) {
    onChange(h.id);
    onSelectedLabel(`${h.name} — ${h.caseNumber}`);
    setOpen(false);
    setQuery('');
  }

  function clear() {
    onChange('');
    onSelectedLabel('');
    setQuery('');
  }

  const INPUT = 'w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500';

  return (
    <div ref={boxRef} className="relative">
      {value && selectedLabel ? (
        <div className="flex items-center justify-between gap-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-3 py-2">
          <span className="text-sm text-emerald-200 truncate">{selectedLabel}</span>
          <button type="button" onClick={clear} className="text-emerald-300 hover:text-white flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            placeholder="Rechercher par nom ou n° de dossier…"
            className={INPUT + ' pl-9'}
          />
        </div>
      )}

      {open && !value && (query.trim() || loading) && (
        <div className="absolute z-[1200] mt-1 w-full bg-slate-900 border border-slate-700 rounded-xl shadow-xl max-h-64 overflow-auto">
          {loading && <div className="px-3 py-2 text-xs text-slate-500">Recherche…</div>}
          {!loading && hits.length === 0 && <div className="px-3 py-2 text-xs text-slate-500">Aucun résultat</div>}
          {hits.map((h) => (
            <button
              key={h.id}
              type="button"
              onClick={() => pick(h)}
              className="w-full text-left px-3 py-2 hover:bg-slate-800 border-b border-slate-800 last:border-0"
            >
              <div className="text-sm text-white">{h.name}</div>
              <div className="text-[11px] text-slate-500">{h.caseNumber}</div>
            </button>
          ))}
        </div>
      )}

      {/* Submitted with the form */}
      <input type="hidden" name="case_id" value={value} />
    </div>
  );
}
