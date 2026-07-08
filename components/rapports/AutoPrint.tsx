'use client';

import { useEffect } from 'react';

// ?print=1 → open the browser print dialog once the report has rendered.
// The "PDF" buttons on the reports hub relied on this param doing something.
export default function AutoPrint({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled) return;
    const t = setTimeout(() => window.print(), 600);
    return () => clearTimeout(t);
  }, [enabled]);
  return null;
}
