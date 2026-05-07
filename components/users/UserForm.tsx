'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import { ShieldCheck, Users } from 'lucide-react';
import { createUserAction } from '@/app/sigep/dashboard/users/actions';
import type { UserRole } from '@/lib/supabase/types';

const INPUT = 'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent';

const ROLES_FOR_SUPER_ADMIN = [
  { value: 'JUDGE',     label: 'Juge (JUDGE)' },
  { value: 'STRATEGIC', label: 'Stratégique (STRATEGIC)' },
];

const ROLES_FOR_JUDGE = [
  { value: 'OPERATIONAL', label: 'Opérationnel — Police / Agent de terrain' },
];

interface Props {
  creatorRole: UserRole;
}

export default function UserForm({ creatorRole }: Props) {
  const [state, formAction, isPending] = useActionState(createUserAction, null);
  const [accessScope, setAccessScope] = useState<'FULL' | 'RESTRICTED'>('FULL');

  const isJudge = creatorRole === 'JUDGE';
  const roles = isJudge ? ROLES_FOR_JUDGE : ROLES_FOR_SUPER_ADMIN;

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
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          {isJudge ? "Affectation & portée d'accès" : 'Rôle & juridiction'}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Rôle *</label>
            <select name="role" required className={`${INPUT} bg-white`}>
              <option value="">— Choisir un rôle —</option>
              {roles.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">N° de badge</label>
            <input name="badge_number" type="text" placeholder={isJudge ? 'PJ-001' : 'JUG-001'} className={INPUT} />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Juridiction / Affectation</label>
            <input
              name="jurisdiction"
              type="text"
              placeholder={isJudge ? 'Direction Centrale de la Police Judiciaire...' : 'TGI Ouagadougou...'}
              className={INPUT}
            />
          </div>

          {/* ── Scope of Access toggle — JUDGE only ─────────────────────── */}
          {isJudge && (
            <div className="sm:col-span-2 space-y-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Portée d&apos;accès aux dossiers *
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setAccessScope('FULL')}
                  className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-left transition-all ${
                    accessScope === 'FULL'
                      ? 'border-emerald-500 bg-emerald-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <ShieldCheck className={`w-4 h-4 mt-0.5 flex-shrink-0 ${accessScope === 'FULL' ? 'text-emerald-600' : 'text-gray-400'}`} />
                  <div>
                    <p className={`text-sm font-semibold ${accessScope === 'FULL' ? 'text-emerald-700' : 'text-gray-700'}`}>
                      Accès complet
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                      L&apos;agent consulte tous les dossiers relevant de votre juridiction.
                    </p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setAccessScope('RESTRICTED')}
                  className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-left transition-all ${
                    accessScope === 'RESTRICTED'
                      ? 'border-amber-500 bg-amber-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <Users className={`w-4 h-4 mt-0.5 flex-shrink-0 ${accessScope === 'RESTRICTED' ? 'text-amber-600' : 'text-gray-400'}`} />
                  <div>
                    <p className={`text-sm font-semibold ${accessScope === 'RESTRICTED' ? 'text-amber-700' : 'text-gray-700'}`}>
                      Accès restreint
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                      Uniquement les dossiers manuellement assignés à cet agent.
                    </p>
                  </div>
                </button>
              </div>
              <input type="hidden" name="access_scope" value={accessScope} />
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit" disabled={isPending}
          className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
        >
          {isPending ? 'Création en cours...' : isJudge ? 'Créer le compte agent' : 'Créer le compte'}
        </button>
        <Link href="/sigep/dashboard/users" className="text-sm text-gray-500 hover:text-gray-700">
          Annuler
        </Link>
      </div>
    </form>
  );
}
