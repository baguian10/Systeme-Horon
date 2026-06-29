'use client';

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="no-print px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700"
    >
      🖨️ Imprimer l&apos;étiquette
    </button>
  );
}
