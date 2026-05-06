'use client';

import { useState, useTransition } from 'react';
import { Plus, Trash2, ShieldAlert, ShieldCheck, ChevronDown, ChevronUp } from 'lucide-react';
import { addGeofenceAction, deleteGeofenceAction } from '@/app/sigep/dashboard/cases/actions';
import type { Geofence } from '@/lib/supabase/types';

interface Props {
  caseId: string;
  geofences: Geofence[];
  canManage: boolean;
}

const INPUT = 'w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

export default function GeofenceManager({ caseId, geofences, canManage }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [isPending, startTransition] = useTransition();

  function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await addGeofenceAction(null, fd);
      if (result?.error) {
        setFormError(result.error);
      } else {
        setFormError(null);
        setShowForm(false);
        setFormKey((k) => k + 1);
      }
    });
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">Géofences ({geofences.length})</h3>
        {canManage && (
          <button
            onClick={() => { setShowForm(!showForm); setFormError(null); }}
            className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium"
          >
            <Plus className="w-3.5 h-3.5" />
            Ajouter
            {showForm ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        )}
      </div>

      {/* Add form */}
      {showForm && (
        <div className="px-5 py-4 bg-blue-50/40 border-b border-blue-100">
          <form key={formKey} onSubmit={handleAdd} className="space-y-3">
            <input type="hidden" name="case_id" value={caseId} />

            {formError && (
              <p className="text-xs text-red-600 font-medium">{formError}</p>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Nom de la zone *</label>
                <input name="name" type="text" required placeholder="Ex : Domicile — rayon 500m" className={INPUT} />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
                <select name="is_exclusion" className={`${INPUT} bg-white`}>
                  <option value="false">Zone autorisée (inclusion)</option>
                  <option value="true">Zone interdite (exclusion)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Rayon (km)</label>
                <input name="radius_km" type="number" step="0.1" min="0.1" max="50" defaultValue="0.5" className={INPUT} />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Latitude centre *</label>
                <input name="center_lat" type="number" step="0.0001" required placeholder="12.6500" className={INPUT} />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Longitude centre *</label>
                <input name="center_lon" type="number" step="0.0001" required placeholder="-7.9800" className={INPUT} />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Heure début (opt.)</label>
                <input name="active_start" type="time" className={INPUT} />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Heure fin (opt.)</label>
                <input name="active_end" type="time" className={INPUT} />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="submit" disabled={isPending}
                className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-500 disabled:opacity-60 transition-colors"
              >
                {isPending ? 'Ajout...' : 'Ajouter la zone'}
              </button>
              <button
                type="button" onClick={() => { setShowForm(false); setFormError(null); }}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                Annuler
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Geofence list */}
      {geofences.length === 0 ? (
        <p className="text-sm text-gray-400 px-5 py-4">Aucune géofence configurée</p>
      ) : (
        <ul className="divide-y divide-gray-50">
          {geofences.map((g) => (
            <li key={g.id} className="px-5 py-3 flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${g.is_exclusion ? 'bg-red-400' : 'bg-green-400'}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800">{g.name}</p>
                <p className="text-xs text-gray-400">
                  {g.is_exclusion ? 'Zone interdite' : 'Zone autorisée'}
                  {g.active_start ? ` · ${g.active_start} – ${g.active_end}` : ' · Toujours active'}
                </p>
              </div>
              {g.is_exclusion
                ? <ShieldAlert className="w-4 h-4 text-red-400 flex-shrink-0" />
                : <ShieldCheck className="w-4 h-4 text-green-400 flex-shrink-0" />}
              {canManage && (
                <form action={deleteGeofenceAction}>
                  <input type="hidden" name="geofence_id" value={g.id} />
                  <input type="hidden" name="case_id" value={caseId} />
                  <button
                    type="submit"
                    title="Supprimer cette zone"
                    className="p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
