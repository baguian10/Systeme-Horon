'use client';

import { Download } from 'lucide-react';

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors print:hidden"
    >
      <Download className="w-4 h-4" />
      Télécharger en PDF
    </button>
  );
}
