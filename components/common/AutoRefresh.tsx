'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Periodically re-runs the server component (router.refresh) so every
// server-rendered value on the page — KPI tiles, live telemetry, added/removed
// rows — stays current without a manual reload. Client state (filters, scroll)
// is preserved. Pauses while the tab is hidden to avoid needless work.
export default function AutoRefresh({ intervalMs = 20_000 }: { intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState !== 'visible') return;
      // Don't refresh while the operator is typing/selecting in a field — a
      // re-render would disrupt an in-progress edit (SIM, beacon config, search).
      const ae = document.activeElement;
      if (ae && ['INPUT', 'TEXTAREA', 'SELECT'].includes(ae.tagName)) return;
      if (ae instanceof HTMLElement && ae.isContentEditable) return;
      router.refresh();
    };
    const id = setInterval(tick, intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);
  return null;
}
