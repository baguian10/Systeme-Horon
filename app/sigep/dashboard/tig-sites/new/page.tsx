'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { ArrowLeft, MapPin } from 'lucide-react';
import { createTigSiteAction } from '../actions';

const INPUT = 'w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white';

const CATEGORIES = [
  { value: 'MAIRIE',      label: 'Mairie / Administration' },
  { value: 'HOPITAL',     label: 'Santé (hôpital / CSPS)' },
  { value: 'ECOLE',       label: 'Éducation (école / lycée)' },
  { value: 'ONG',         label: 'ONG / Association agréée' },
  { value: 'ESPACE_VERT', label: 'Espace vert / environnement' },
  { value: 'AUTRE',       label: 'Autre' },
];

const ARRONDISSEMENTS = [
  'Baskuy', 'Bogodogo', 'Boulmiougou', 'Nongremassom', 'Sig-Nonghin',
];

export default function NewTigSitePage() {
  const [state, formAction, isPending] = useActionState(createTigSiteAction, null);

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/sigep/dashboard/tig-sites"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour aux sites
        </Link>
      </div>

      <div>
        <h2 className="text-xl font-bold text-gray-900">Nouveau site TIG</h2>
        <p className="text-sm text-gray-500 mt-0.5">Enregistrer une nouvelle structure d&apos;accueil agréée par le tribunal.</p>
      </div>

      {state?.error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          {state.error}
        </div>
      )}

      <form action={formAction} className="space-y-5">
        {/* Identité du site */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Identification</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Nom du site *</label>
              <input name="name" type="text" required placeholder="ex: Lycée Philippe Zinda Kaboré" className={INPUT} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Catégorie *</label>
                <select name="category" required className={INPUT}>
                  <option value="">Sélectionner…</option>
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Arrondissement *</label>
                <select name="arrondissement" required className={INPUT}>
                  <option value="">Sélectionner…</option>
                  {ARRONDISSEMENTS.map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Adresse complète *</label>
              <input name="address" type="text" required placeholder="Rue, Secteur, Quartier" className={INPUT} />
            </div>
          </div>
        </div>

        {/* Contact */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Contact du responsable</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Nom du référent *</label>
              <input name="contact_name" type="text" required placeholder="Prénom Nom" className={INPUT} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Téléphone</label>
              <input name="contact_phone" type="tel" placeholder="+226 XX XX XX XX" className={INPUT} />
            </div>
          </div>
        </div>

        {/* Capacité & horaires */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Capacité & horaires</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Capacité d&apos;accueil *</label>
              <input name="capacity" type="number" required min={1} max={50} defaultValue={4} className={INPUT} />
              <p className="text-[10px] text-gray-400 mt-1">Nombre max de bénéficiaires simultanés</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Horaires de travail</label>
              <input name="hours" type="text" placeholder="Lun–Ven 07h00–12h00" className={INPUT} />
            </div>
          </div>
        </div>

        {/* Géolocalisation */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-emerald-600" />
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Coordonnées GPS (optionnel)</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Latitude</label>
              <input name="latitude" type="number" step="0.000001" placeholder="12.364700" className={INPUT} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Longitude</label>
              <input name="longitude" type="number" step="0.000001" placeholder="-1.533200" className={INPUT} />
            </div>
          </div>
          <p className="text-[10px] text-gray-400">
            Utilisez Google Maps pour obtenir les coordonnées précises du site.
            Ces coordonnées serviront à créer automatiquement la géofence dans SIGEP.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={isPending}
            className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500 disabled:opacity-50 transition-colors"
          >
            {isPending ? 'Enregistrement…' : 'Créer le site TIG'}
          </button>
          <Link href="/sigep/dashboard/tig-sites" className="text-sm text-gray-500 hover:text-gray-700">
            Annuler
          </Link>
        </div>
      </form>
    </div>
  );
}
