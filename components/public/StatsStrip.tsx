'use client';

import { useRef, useEffect, useState } from 'react';

const STATS = [
  { target: 73,   suffix: '%',  label: 'Réduction de la récidive',    sub: 'vs détention classique' },
  { target: null, display: '24/7', label: 'Surveillance continue',    sub: 'sans interruption' },
  { target: 3,    suffix: '×',  label: 'Réinsertion professionnelle', sub: "meilleure qu'en prison" },
  { target: 100,  suffix: '%',  label: 'Conformité juridique',        sub: 'Code de procédure pénale' },
] as const;

function CountUp({ target, suffix }: { target: number; suffix: string }) {
  const [count, setCount] = useState(0);
  const spanRef = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = spanRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const duration = 1400;
          const startTime = performance.now();
          const tick = (now: number) => {
            const progress = Math.min((now - startTime) / duration, 1);
            const ease = 1 - Math.pow(1 - progress, 3);
            setCount(Math.round(ease * target));
            if (progress < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [target]);

  return <span ref={spanRef}>{count}{suffix}</span>;
}

export default function StatsStrip() {
  return (
    <div className="relative z-10 border-t border-slate-700/60 bg-slate-900/70 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-6 py-6 grid grid-cols-2 md:grid-cols-4 gap-6">
        {STATS.map((s) => (
          <div key={s.label} className="text-center">
            <p className="text-3xl font-bold text-emerald-400">
              {s.target !== null
                ? <CountUp target={s.target} suffix={s.suffix} />
                : s.display}
            </p>
            <p className="text-xs font-semibold text-white mt-1">{s.label}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
