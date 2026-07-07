'use client';

import { useState, useTransition } from 'react';
import { Pencil } from 'lucide-react';
import { updateTigSiteAction } from '@/app/sigep/dashboard/tig-sites/actions';
import type { TigSite } from '@/lib/supabase/types';

const CATEGORIES = [
  { value: 'MAIRIE',      label: 'Mairie / Administration' },
  { value: 'HOPITAL',     label: 'Santé (hôpital / CSPS)' },
  { value: 'ECOLE',       label: 'Éducation (école / lycée)' },
  { value: 'ONG',         label: 'ONG / Association agréée' },
  { value: 'ESPACE_VERT', label: 'Espace vert / environnement' },
  { value: 'AUTRE',       label: 'Autre' },
];

const ARRONDISSEMENTS = [
  // Ouagadougou
  'Baskuy', 'Bogodogo', 'Boulmiougou', 'Nongremassom', 'Sig-Nonghin',
  // Bobo-Dioulasso
  'Dô', 'Dafra', 'Konsa', 'Bindougousso',
  // Koudougou
  'Koudougou Centre', 'Koudougou Nord', 'Koudougou Sud',
  // Ouahigouya
  'Ouahigouya',
  // Banfora
  'Banfora',
  // Autre
  'Autre commune',
];

const IN = 'w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500';

export default function EditTigSiteButton({ site }: { site: TigSite }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await updateTigSiteAction(fd);
      if (result?.error) { setError(result.error); return; }
      setOpen(false);
    });
  }

  return (
    <>
      <button
        onClick={() => { setOpen(true); setError(null); }}
        title="Modifier ce site"
        className="text-gray-300 hover:text-emerald-500 transition-colors"
      >
        <Pencil className="w-3.5 h-3.5" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[2000] bg-black/40 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-5 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-gray-900 mb-4">Modifier « {site.name} »</h3>
            <form onSubmit={submit} className="space-y-3">
              <input type="hidden" name="id" value={site.id} />

              <div>
                <label className="block text-xs text-gray-500 mb-1">Nom du site *</label>
                <input name="name" required defaultValue={site.name} className={IN} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Catégorie</label>
                  <select name="category" defaultValue={site.category} className={IN}>
                    {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Capacité</label>
                  <input name="capacity" type="number" min={1} max={100} required defaultValue={site.capacity} className={IN} />
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">Adresse *</label>
                <input name="address" required defaultValue={site.address} className={IN} />
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">Arrondissement / commune *</label>
                <select name="arrondissement" defaultValue={site.arrondissement} className={IN}>
                  {ARRONDISSEMENTS.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Contact *</label>
                  <input name="contact_name" required defaultValue={site.contact_name} className={IN} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Téléphone</label>
                  <input name="contact_phone" defaultValue={site.contact_phone} className={IN} />
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">Horaires</label>
                <input name="hours" defaultValue={site.hours} placeholder="Lun–Ven 08h00–17h00" className={IN} />
              </div>

              {error && <p className="text-xs text-red-600">{error}</p>}

              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setOpen(false)} className="px-3 py-1.5 rounded-lg bg-gray-100 text-sm">
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold disabled:opacity-40"
                >
                  {pending ? '…' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
