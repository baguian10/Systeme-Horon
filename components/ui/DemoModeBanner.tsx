'use client';

import { Info } from 'lucide-react';
import { IS_DEMO_MODE } from '@/lib/supabase/client';

export default function DemoModeBanner() {
  if (!IS_DEMO_MODE) return null;
  return (
    <div className="bg-amber-50 border-b border-amber-200 px-6 py-2 flex items-center gap-2 text-sm text-amber-800">
      <Info className="w-4 h-4 flex-shrink-0" />
      <span>
        <strong>Mode démo</strong> — Données fictives. Configurez{' '}
        <code className="font-mono bg-amber-100 px-1 rounded text-xs">NEXT_PUBLIC_SUPABASE_URL</code> pour activer le backend réel.
      </span>
    </div>
  );
}
