'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { createCaseAction } from '@/app/sigep/dashboard/cases/actions';
import type { Device } from '@/lib/supabase/types';

interface Props {
  unassignedDevices: Device[];
}

const INPUT = 'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';

export default function CaseForm({ unassignedDevices }: Props) {
  const [state, formAction, isPending] = useActionState(createCaseAction, null);

  return (
    <form action={formAction} className="space-y-5">
      {state?.error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          {state.error}
        </div>
      )}

      {/* Individual */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Individu concerné</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Nom complet *</label>
            <input name="full_name" type="text" required placeholder="Prénom Nom" className={INPUT} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">N° identité nationale *</label>
            <input name="national_id" type="text" required placeholder="MLI-AAAA-XXXX" className={INPUT} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Date de naissance *</label>
            <input name="date_of_birth" type="date" required className={INPUT} />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Adresse</label>
            <input name="address" type="text" placeholder="Quartier, Commune, Bamako" className={INPUT} />
          </div>
        </div>
      </div>

      {/* Case details */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Ordonnance & dispositif</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Date de l'ordonnance *</label>
            <input name="court_order_date" type="date" required className={INPUT} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Bracelet assigné</label>
            <select name="device_id" className={`${INPUT} bg-white`}>
              <option value="">— Aucun pour l'instant —</option>
              {unassignedDevices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.imei} · {d.model} · {d.battery_pct}% bat.
                </option>
              ))}
            </select>
            {unassignedDevices.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">Aucun bracelet disponible actuellement</p>
            )}
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Notes du juge</label>
            <textarea
              name="notes" rows={3}
              placeholder="Contexte de l'affaire, restrictions particulières..."
              className={`${INPUT} resize-none`}
            />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit" disabled={isPending}
          className="px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
        >
          {isPending ? 'Création en cours...' : 'Créer le dossier'}
        </button>
        <Link href="/sigep/dashboard/cases" className="text-sm text-gray-500 hover:text-gray-700">
          Annuler
        </Link>
      </div>
    </form>
  );
}
