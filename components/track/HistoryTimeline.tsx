'use client';

export interface TimelineEvent { t: number; type: 'ENTER' | 'EXIT'; isExclusion: boolean }

interface Props {
  min: number; // epoch ms
  max: number;
  value: number;
  playing: boolean;
  speed: number;
  events?: TimelineEvent[];
  onChange: (t: number) => void;
  onTogglePlay: () => void;
  onSpeed: (s: number) => void;
}

const SPEEDS = [1, 2, 4, 8, 16];

export default function HistoryTimeline({ min, max, value, playing, speed, events = [], onChange, onTogglePlay, onSpeed }: Props) {
  const span = Math.max(1, max - min);
  const pct = (t: number) => ((t - min) / span) * 100;

  return (
    <div className="bg-white border-t border-gray-200 px-4 py-3 flex items-center gap-3">
      <button
        onClick={onTogglePlay}
        className="shrink-0 w-10 h-10 rounded-full bg-violet-600 text-white flex items-center justify-center hover:bg-violet-700 transition"
        aria-label={playing ? 'Pause' : 'Lecture'}
      >
        {playing ? '❚❚' : '▶'}
      </button>

      <div className="flex-1 relative">
        {/* event ticks */}
        <div className="absolute inset-x-0 top-0 h-2 pointer-events-none">
          {events.map((e, i) => (
            <span
              key={i}
              title={`${e.type === 'ENTER' ? 'Entrée' : 'Sortie'} zone`}
              className="absolute top-0 w-0.5 h-2 rounded"
              style={{ left: `${pct(e.t)}%`, background: e.isExclusion ? '#dc2626' : '#2563eb' }}
            />
          ))}
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={1000}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full accent-violet-600 mt-2"
        />
        <div className="flex justify-between text-[11px] text-gray-500 mt-0.5">
          <span>{fmt(min)}</span>
          <span className="font-semibold text-violet-700">{fmt(value)}</span>
          <span>{fmt(max)}</span>
        </div>
      </div>

      <select
        value={speed}
        onChange={(e) => onSpeed(Number(e.target.value))}
        className="shrink-0 border border-gray-300 rounded-lg text-sm px-2 py-1.5"
        aria-label="Vitesse de lecture"
      >
        {SPEEDS.map((s) => (
          <option key={s} value={s}>×{s}</option>
        ))}
      </select>
    </div>
  );
}

function fmt(ms: number): string {
  return new Date(ms).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'UTC' });
}
