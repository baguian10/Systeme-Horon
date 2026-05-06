'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { createUserAction } from '@/app/sigep/dashboard/users/actions';

const INPUT = 'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';

const ROLES = [
  { value: 'JUDGE',       label: 'Juge (JUDGE)' },
  { value: 'OPERATIONAL', label: 'Opérationnel (OPERATIONAL)' },
  { value: 'STRATEGIC',   label: 'Stratégique (STRATEGIC)' },
  { value: 'SUPER_ADMIN', label: 'Super Admin (SUPER_ADMIN)' },
];

export default function UserForm() {
  const [state, formAction, isPending] = useActionState(createUserAction, null);

  return (
    <form action={formAction} className="space-y-5">
      {state?.error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          {state.error}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Identité</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Nom complet *</label>
            <input name="full_name" type="text" required placeholder="Prénom Nom" className={INPUT} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Adresse e-mail *</label>
            <input name="email" type="email" required placeholder="agent@justice.gov.bf" className={INPUT} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Mot de passe provisoire *</label>
            <input name="password" type="password" required minLength={8} placeholder="Min. 8 caractères" className={INPUT} />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Rôle & juridiction</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Rôle *</label>
            <select name="role" required className={`${INPUT} bg-white`}>
              <option value="">— Choisir un rôle —</option>
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">N° de badge</label>
            <input name="badge_number" type="text" placeholder="JUG-001" className={INPUT} />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Juridiction / Affectation</label>
            <input name="jurisdiction" type="text" placeholder="TGI Ouagadougou, DCPJ..." className={INPUT} />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit" disabled={isPending}
          className="px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
        >
          {isPending ? 'Création en cours...' : 'Créer le compte'}
        </button>
        <Link href="/sigep/dashboard/users" className="text-sm text-gray-500 hover:text-gray-700">
          Annuler
        </Link>
      </div>
    </form>
  );
}
