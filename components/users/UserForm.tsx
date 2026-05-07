'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import { ShieldCheck, Users, CheckCircle } from 'lucide-react';
import { createUserAction } from '@/app/sigep/dashboard/users/actions';
import type { UserRole } from '@/lib/supabase/types';

const INPUT = 'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent';

/* ── Role definitions with level, description, and example profiles ── */
const ROLE_CARDS_SUPER_ADMIN = [
  {
    value: 'STRATEGIC',
    level: 'N1',
    color: 'purple',
    title: 'Niveau Stratégique',
    subtitle: 'Direction & Ministère',
    desc: "Accès aux statistiques agrégées et tableaux de bord nationaux. Aucun accès aux dossiers individuels.",
    profiles: [
      'Directeur de Cabinet',
      'Secrétaire Général',
      'Directeur des Affaires Juridiques',
      'Contrôleur Général',
    ],
  },
  {
    value: 'JUDGE',
    level: 'N2',
    color: 'blue',
    title: 'Niveau Judiciaire',
    subtitle: 'Magistrats & Parquet',
    desc: "Gestion complète des dossiers de sa juridiction, création des périmètres et délégation aux agents opérationnels.",
    profiles: [
      "Juge d'instruction",
      'Juge de fond / TGI',
      'Procureur du Faso',
      'Substitut du Procureur',
    ],
  },
  {
    value: 'OPERATIONAL',
    level: 'N3',
    color: 'emerald',
    title: 'Niveau Opérationnel',
    subtitle: 'Agents de terrain & Pénitentiaires',
    desc: "Accès restreint aux dossiers assignés. Réception des alertes GPS, rapports de terrain et suivi des bracelets électroniques.",
    profiles: [
      'Officier de Police Judiciaire (OPJ)',
      'Agent Pénitentiaire / Établissement',
      'Gendarme / Brigade territoriale',
      'Travailleur social — suivi TIG',
    ],
  },
];

const ROLE_CARDS_JUDGE = [
  {
    value: 'OPERATIONAL',
    level: 'N3',
    color: 'emerald',
    title: 'Niveau Opérationnel',
    subtitle: 'Agents de terrain & Pénitentiaires',
    desc: "Accès restreint aux dossiers assignés par le juge. Réception des alertes GPS, suivi terrain et rapports de présence.",
    profiles: [
      'Officier de Police Judiciaire (OPJ)',
      'Agent Pénitentiaire / Établissement',
      'Gendarme / Brigade territoriale',
      'Travailleur social — suivi TIG',
    ],
  },
];

const COLOR_MAP: Record<string, { ring: string; bg: string; badge: string; dot: string; text: string; check: string }> = {
  purple: {
    ring:  'border-purple-400 bg-purple-50',
    bg:    'border-purple-100',
    badge: 'bg-purple-100 text-purple-700',
    dot:   'bg-purple-400',
    text:  'text-purple-700',
    check: 'text-purple-500',
  },
  blue: {
    ring:  'border-blue-400 bg-blue-50',
    bg:    'border-blue-100',
    badge: 'bg-blue-100 text-blue-700',
    dot:   'bg-blue-400',
    text:  'text-blue-700',
    check: 'text-blue-500',
  },
  emerald: {
    ring:  'border-emerald-400 bg-emerald-50',
    bg:    'border-emerald-100',
    badge: 'bg-emerald-100 text-emerald-700',
    dot:   'bg-emerald-400',
    text:  'text-emerald-700',
    check: 'text-emerald-500',
  },
};

interface Props {
  creatorRole: UserRole;
}

export default function UserForm({ creatorRole }: Props) {
  const [state, formAction, isPending] = useActionState(createUserAction, null);
  const [selectedRole, setSelectedRole] = useState('');
  const [accessScope, setAccessScope] = useState<'FULL' | 'RESTRICTED'>('FULL');

  const isJudge = creatorRole === 'JUDGE';
  const roleCards = isJudge ? ROLE_CARDS_JUDGE : ROLE_CARDS_SUPER_ADMIN;

  return (
    <form action={formAction} className="space-y-5">
      {state?.error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          {state.error}
        </div>
      )}

      {/* ── Identité ─────────────────────────────────────────────────── */}
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

      {/* ── Niveau d'accès ───────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-0.5">
            Niveau d&apos;accès *
          </h3>
          <p className="text-[11px] text-gray-400">
            Sélectionnez le niveau hiérarchique correspondant au profil de l&apos;utilisateur.
          </p>
        </div>

        <div className={`grid gap-4 ${roleCards.length === 1 ? 'grid-cols-1' : roleCards.length === 3 ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1 md:grid-cols-2'}`}>
          {roleCards.map((card) => {
            const c = COLOR_MAP[card.color];
            const isSelected = selectedRole === card.value;
            return (
              <button
                key={card.value}
                type="button"
                onClick={() => setSelectedRole(card.value)}
                className={`w-full text-left rounded-2xl border-2 p-4 transition-all ${
                  isSelected ? c.ring : 'border-gray-100 hover:border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${c.badge}`}>
                      {card.level}
                    </span>
                    <span className={`text-sm font-bold ${isSelected ? c.text : 'text-gray-800'}`}>
                      {card.title}
                    </span>
                  </div>
                  {isSelected && <CheckCircle className={`w-4 h-4 flex-shrink-0 ${c.check}`} />}
                </div>

                <p className={`text-xs font-semibold mb-1 ${isSelected ? c.text : 'text-gray-500'}`}>
                  {card.subtitle}
                </p>
                <p className="text-xs text-gray-500 leading-relaxed mb-3">
                  {card.desc}
                </p>

                <div className={`rounded-xl border p-3 ${isSelected ? c.bg : 'border-gray-100 bg-gray-50'}`}>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                    Profils concernés
                  </p>
                  <ul className="space-y-1">
                    {card.profiles.map((p) => (
                      <li key={p} className="flex items-center gap-2 text-xs text-gray-600">
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isSelected ? c.dot : 'bg-gray-300'}`} />
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              </button>
            );
          })}
        </div>

        {/* Hidden input carrying the selected role value */}
        <input type="hidden" name="role" value={selectedRole} />
        {!selectedRole && state && (
          <p className="text-xs text-red-500">Veuillez sélectionner un niveau d&apos;accès.</p>
        )}
      </div>

      {/* ── Affectation ──────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          {selectedRole === 'OPERATIONAL' ? "Affectation & portée d'accès" : 'Affectation'}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">N° de badge</label>
            <input
              name="badge_number"
              type="text"
              placeholder={
                selectedRole === 'OPERATIONAL' ? 'OPJ-001 / AP-042...' :
                selectedRole === 'JUDGE' ? 'JUG-017' : 'MIN-042'
              }
              className={INPUT}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Juridiction / Affectation</label>
            <input
              name="jurisdiction"
              type="text"
              placeholder={
                selectedRole === 'OPERATIONAL' ? 'Brigade PJ / Maison d\'arrêt / DCPJ...' :
                selectedRole === 'JUDGE' ? 'TGI Ouagadougou...' :
                'Ministère de la Justice...'
              }
              className={INPUT}
            />
          </div>

          {/* ── Scope of Access — for OPERATIONAL role ──────────────── */}
          {selectedRole === 'OPERATIONAL' && (
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
          type="submit"
          disabled={isPending || !selectedRole}
          className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
