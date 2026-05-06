import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getSession } from '@/lib/auth/session';
import { canCreateCase } from '@/lib/auth/permissions';
import { createCaseAction } from '../actions';

export const metadata = { title: 'Nouveau dossier — SIGEP' };

export default async function NewCasePage() {
  const session = await getSession();
  if (!session || !canCreateCase(session.role)) redirect('/sigep/dashboard/cases');

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <Link
          href="/sigep/dashboard/cases"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Retour
        </Link>
        <h2 className="text-xl font-bold text-gray-900">Nouveau dossier</h2>
        <p className="text-sm text-gray-500 mt-0.5">Créer un placement sous surveillance électronique</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <form action={createCaseAction} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Numéro d'identité nationale
              </label>
              <input
                type="text"
                name="national_id"
                required
                placeholder="MLI-AAAA-XXXX"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-400 mt-1">L'individu doit déjà être enregistré dans le système</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Date de l'ordonnance</label>
              <input
                type="date"
                name="court_order_date"
                required
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Date de début</label>
              <input
                type="date"
                name="start_date"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes et conditions</label>
              <textarea
                name="notes"
                rows={4}
                placeholder="Conditions de l'ordonnance, restrictions particulières..."
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-50">
            <Link
              href="/sigep/dashboard/cases"
              className="px-4 py-2 rounded-xl text-sm text-gray-600 hover:bg-gray-100 transition-colors"
            >
              Annuler
            </Link>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 transition-colors"
            >
              Créer le dossier
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
