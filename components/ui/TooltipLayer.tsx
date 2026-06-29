'use client';

import { useEffect, useState } from 'react';

// Global floating-tooltip layer. Any element with a `data-tip="..."` attribute
// shows a styled bubble on hover or keyboard focus — no per-button wiring beyond
// the attribute. Mount once in the dashboard layout.
interface Tip { text: string; x: number; y: number; above: boolean }

export default function TooltipLayer() {
  const [tip, setTip] = useState<Tip | null>(null);

  useEffect(() => {
    let raf = 0;

    const show = (el: Element) => {
      const host = (el as HTMLElement).closest('[data-tip]') as HTMLElement | null;
      const text = host?.getAttribute('data-tip');
      if (!host || !text) return;
      const r = host.getBoundingClientRect();
      const above = r.top > 56; // enough room above? else show below
      setTip({
        text,
        x: Math.min(Math.max(r.left + r.width / 2, 90), window.innerWidth - 90),
        y: above ? r.top - 8 : r.bottom + 8,
        above,
      });
    };
    const hide = () => setTip(null);

    const onOver = (e: Event) => {
      const t = e.target as Element | null;
      if (t && (t.closest?.('[data-tip]'))) {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => show(t));
      }
    };
    const onOut = (e: Event) => {
      const t = e.target as Element | null;
      if (t && t.closest?.('[data-tip]')) hide();
    };

    document.addEventListener('mouseover', onOver, true);
    document.addEventListener('mouseout', onOut, true);
    document.addEventListener('focusin', onOver, true);
    document.addEventListener('focusout', onOut, true);
    window.addEventListener('scroll', hide, true);
    return () => {
      document.removeEventListener('mouseover', onOver, true);
      document.removeEventListener('mouseout', onOut, true);
      document.removeEventListener('focusin', onOver, true);
      document.removeEventListener('focusout', onOut, true);
      window.removeEventListener('scroll', hide, true);
      cancelAnimationFrame(raf);
    };
  }, []);

  if (!tip) return null;
  return (
    <div
      role="tooltip"
      style={{
        position: 'fixed',
        left: tip.x,
        top: tip.y,
        transform: `translate(-50%, ${tip.above ? '-100%' : '0'})`,
        zIndex: 9999,
        pointerEvents: 'none',
        maxWidth: 280,
      }}
      className="px-2.5 py-1.5 rounded-lg bg-gray-900 text-white text-xs leading-snug shadow-lg"
    >
      {tip.text}
    </div>
  );
}
