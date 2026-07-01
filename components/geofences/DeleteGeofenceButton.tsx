'use client';

import { Trash2 } from 'lucide-react';
import { deleteGeofenceAction } from '@/app/sigep/dashboard/geofences/actions';

// Confirm before deleting — geofences are judicial records, no accidental clicks.
export default function DeleteGeofenceButton({ geofenceId, caseId, name }: { geofenceId: string; caseId: string; name: string }) {
  return (
    <form
      action={deleteGeofenceAction}
      onSubmit={(e) => {
        if (!confirm(`Supprimer définitivement la géofence « ${name} » ? Cette action est irréversible.`)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="geofence_id" value={geofenceId} />
      <input type="hidden" name="case_id" value={caseId} />
      <button
        type="submit"
        title="Supprimer"
        className="p-1 text-slate-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </form>
  );
}
