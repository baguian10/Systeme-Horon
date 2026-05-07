'use client';

import { Printer } from 'lucide-react';

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-700 transition-colors print:hidden"
    >
      <Printer className="w-4 h-4" />
      Imprimer / Sauvegarder PDF
    </button>
  );
}
