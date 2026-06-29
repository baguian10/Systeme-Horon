'use client';

import { useEffect, useState } from 'react';

interface Props {
  caseId: string;
  value: string; // YYYY-MM-DD
  onChange: (date: string) => void;
}

const WD = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

function iso(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

export default function DayPicker({ caseId, value, onChange }: Props) {
  const [cursor, setCursor] = useState(() => new Date(`${value}T00:00:00Z`));
  const [daysWithData, setDaysWithData] = useState<Set<string>>(new Set());
  const month = `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, '0')}`;

  useEffect(() => {
    let active = true;
    fetch(`/api/track/history?caseId=${encodeURIComponent(caseId)}&mode=days&month=${month}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => { if (active && Array.isArray(d.days)) setDaysWithData(new Set(d.days)); })
      .catch(() => {});
    return () => { active = false; };
  }, [caseId, month]);

  const year = cursor.getUTCFullYear();
  const m = cursor.getUTCMonth();
  const first = new Date(Date.UTC(year, m, 1));
  const startWd = (first.getUTCDay() + 6) % 7; // Monday = 0
  const daysInMonth = new Date(Date.UTC(year, m + 1, 0)).getUTCDate();
  const today = iso(new Date());

  const cells: (Date | null)[] = [];
  for (let i = 0; i < startWd; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(Date.UTC(year, m, d)));

  const shift = (delta: number) => setCursor(new Date(Date.UTC(year, m + delta, 1)));

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 w-[260px]">
      <div className="flex items-center justify-between mb-2">
        <button onClick={() => shift(-1)} className="px-2 py-1 rounded hover:bg-gray-100 text-gray-600">‹</button>
        <span className="text-sm font-semibold">{MONTHS[m]} {year}</span>
        <button onClick={() => shift(1)} className="px-2 py-1 rounded hover:bg-gray-100 text-gray-600">›</button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-[11px] text-gray-400 mb-1">
        {WD.map((w, i) => <div key={i} className="text-center">{w}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const id = iso(d);
          const has = daysWithData.has(id);
          const selected = id === value;
          const future = id > today;
          return (
            <button
              key={i}
              disabled={future}
              onClick={() => onChange(id)}
              className={[
                'relative h-8 rounded text-sm flex items-center justify-center',
                selected ? 'bg-violet-600 text-white font-semibold' : has ? 'hover:bg-violet-50 text-gray-800' : 'text-gray-400 hover:bg-gray-50',
                future ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer',
              ].join(' ')}
            >
              {d.getUTCDate()}
              {has && !selected && <span className="absolute bottom-1 w-1 h-1 rounded-full bg-violet-500" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
