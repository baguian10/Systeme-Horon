'use client';

import { useActionState } from 'react';
import { Save, CheckCircle2 } from 'lucide-react';
import { saveSettingsAction } from '@/app/sigep/dashboard/parametres/actions';
import type { SystemSettings } from '@/lib/settings';

const IN = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500';

function Field({ label, name, value, unit, type = 'number' }: { label: string; name: string; value: string | number; unit?: string; type?: string }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}{unit ? ` (${unit})` : ''}</label>
      <input name={name} type={type} defaultValue={String(value)} className={IN} />
    </div>
  );
}

export default function ActiveSettingsForm({ settings }: { settings: SystemSettings }) {
  const [state, action, pending] = useActionState(saveSettingsAction, null);

  return (
    <form action={action} className="bg-white rounded-2xl border border-emerald-100 p-5 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-emerald-700">Paramètres opérationnels (appliqués en temps réel)</h3>
        {state?.ok && <span className="inline-flex items-center gap-1 text-xs text-emerald-600"><CheckCircle2 className="w-4 h-4" /> Enregistré</span>}
      </div>

      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Alertes &amp; surveillance</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Field label="Seuil batterie faible" name="battery_alert_pct" value={settings.battery_alert_pct} unit="%" />
          <Field label="Délai perte signal" name="signal_lost_min" value={settings.signal_lost_min} unit="min" />
          <Field label="Tampon géofence" name="geofence_buffer_m" value={settings.geofence_buffer_m} unit="m" />
          <Field label="Escalade non résolu" name="escalate_minutes" value={settings.escalate_minutes} unit="min" />
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Conservation des données</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Field label="Rétention positions" name="position_retention_days" value={settings.position_retention_days} unit="jours" />
          <Field label="Rétention audit" name="audit_retention_days" value={settings.audit_retention_days} unit="jours" />
          <Field label="Expiration session" name="session_timeout_min" value={settings.session_timeout_min} unit="min" />
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Régional &amp; notifications</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Field label="Fuseau horaire" name="timezone" value={settings.timezone} type="text" />
          <Field label="Fournisseur SMS" name="sms_provider" value={settings.sms_provider ?? ''} type="text" />
          <label className="flex items-end gap-2 text-sm text-gray-700 pb-2">
            <input type="checkbox" name="sms_enabled" defaultChecked={settings.sms_enabled} /> Notifications SMS
          </label>
        </div>
      </div>

      {state?.error && <p className="text-xs text-red-600">{state.error}</p>}
      <button type="submit" disabled={pending} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold disabled:opacity-40">
        <Save className="w-4 h-4" /> {pending ? 'Enregistrement…' : 'Enregistrer les paramètres'}
      </button>
    </form>
  );
}
