'use client';

import { useState } from 'react';
import { Save, CheckCircle2, RefreshCw } from 'lucide-react';

const INPUT = 'w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white';
const SELECT = INPUT;

interface ParamGroup {
  title: string;
  params: Param[];
}

interface Param {
  key:    string;
  label:  string;
  desc:   string;
  type:   'number' | 'select' | 'toggle';
  value:  string | boolean;
  unit?:  string;
  options?: { value: string; label: string }[];
}

const GROUPS: ParamGroup[] = [
  {
    title: 'Synchronisation GPS',
    params: [
      { key: 'report_interval_s', label: 'Intervalle de rapport', desc: 'Fréquence d\'envoi des positions GPS en secondes', type: 'number', value: '30', unit: 'secondes' },
      { key: 'heartbeat_interval_s', label: 'Intervalle heartbeat', desc: 'Fréquence des signaux de vie MQTT', type: 'number', value: '60', unit: 'secondes' },
      { key: 'gps_timeout_s', label: 'Timeout GPS', desc: 'Délai avant déclenchement de l\'alerte SIGNAL_LOST', type: 'number', value: '900', unit: 'secondes' },
      { key: 'network_protocol', label: 'Protocole réseau', desc: 'Protocole de communication utilisé par les bracelets', type: 'select', value: 'MQTT',
        options: [{ value: 'MQTT', label: 'MQTT over TLS' }, { value: 'HTTPS', label: 'HTTPS REST' }, { value: 'TCP', label: 'TCP direct' }] },
    ],
  },
  {
    title: 'Alertes & Seuils',
    params: [
      { key: 'battery_alert_pct', label: 'Seuil batterie faible', desc: 'Déclencher BATTERY_LOW en dessous de ce niveau', type: 'number', value: '20', unit: '%' },
      { key: 'signal_lost_min', label: 'Délai signal perdu', desc: 'Minutes sans contact avant alerte SIGNAL_LOST', type: 'number', value: '15', unit: 'minutes' },
      { key: 'geofence_buffer_m', label: 'Tampon géofence', desc: 'Tolérance GPS avant déclenchement de violation', type: 'number', value: '25', unit: 'mètres' },
      { key: 'severity_auto_escalate', label: 'Escalade automatique', desc: 'Escalader vers le juge si non résolu sous 30 min', type: 'toggle', value: true },
    ],
  },
  {
    title: 'Rétention des données',
    params: [
      { key: 'position_retention_days', label: 'Rétention positions GPS', desc: 'Durée de conservation des traces GPS', type: 'number', value: '90', unit: 'jours' },
      { key: 'audit_retention_days', label: 'Rétention journal d\'audit', desc: 'Durée de conservation du journal d\'audit', type: 'number', value: '365', unit: 'jours' },
      { key: 'alert_archive_days', label: 'Archive alertes', desc: 'Durée avant archivage des alertes résolues', type: 'number', value: '180', unit: 'jours' },
    ],
  },
  {
    title: 'Sessions & Sécurité',
    params: [
      { key: 'session_timeout_min', label: 'Expiration session', desc: 'Durée d\'inactivité avant déconnexion automatique', type: 'number', value: '30', unit: 'minutes' },
      { key: 'max_failed_logins', label: 'Tentatives de connexion max', desc: 'Nombre d\'échecs avant verrouillage du compte', type: 'number', value: '5', unit: 'tentatives' },
      { key: 'require_2fa_judge', label: '2FA obligatoire (Juge)', desc: 'Imposer la double authentification aux juges', type: 'toggle', value: true },
      { key: 'require_2fa_admin', label: '2FA obligatoire (Admin)', desc: 'Imposer la double authentification aux admins', type: 'toggle', value: true },
    ],
  },
];

export default function ParametresForm() {
  type GroupState = Record<string, string | boolean>;
  const [values, setValues] = useState<Record<string, GroupState>>(() => {
    const init: Record<string, GroupState> = {};
    GROUPS.forEach((g) => {
      g.params.forEach((p) => { init[p.key] = { v: p.value }; });
    });
    return init;
  });
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  function getValue(key: string, defaultValue: string | boolean) {
    return (values[key]?.v ?? defaultValue) as string | boolean;
  }

  function setValue(key: string, v: string | boolean) {
    setValues((prev) => ({ ...prev, [key]: { v } }));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 800));
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 4000);
  }

  return (
    <div className="space-y-4">
      {GROUPS.map((group) => (
        <div key={group.title} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-50 bg-gray-50">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{group.title}</h3>
          </div>
          <div className="px-5 py-4 space-y-4">
            {group.params.map((param) => {
              const val = getValue(param.key, param.value);
              return (
                <div key={param.key}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-800 mb-0.5">{param.label}</label>
                      <p className="text-xs text-gray-400">{param.desc}</p>
                    </div>
                    <div className="flex-shrink-0">
                      {param.type === 'toggle' ? (
                        <button
                          type="button"
                          onClick={() => setValue(param.key, !(val as boolean))}
                          className={`relative w-11 h-6 rounded-full transition-colors ${val ? 'bg-emerald-600' : 'bg-gray-200'}`}
                        >
                          <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${val ? 'translate-x-5' : 'translate-x-0'}`} />
                        </button>
                      ) : param.type === 'select' ? (
                        <select
                          value={val as string}
                          onChange={(e) => setValue(param.key, e.target.value)}
                          className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        >
                          {param.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      ) : (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={val as string}
                            onChange={(e) => setValue(param.key, e.target.value)}
                            className="w-20 border border-gray-200 rounded-xl px-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                          {param.unit && <span className="text-xs text-gray-400 whitespace-nowrap">{param.unit}</span>}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Save button */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            saved
              ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
              : 'bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50'
          }`}
        >
          {saving ? (
            <><RefreshCw className="w-4 h-4 animate-spin" /> Enregistrement…</>
          ) : saved ? (
            <><CheckCircle2 className="w-4 h-4" /> Paramètres sauvegardés</>
          ) : (
            <><Save className="w-4 h-4" /> Enregistrer les paramètres</>
          )}
        </button>
        <p className="text-xs text-gray-400">Les modifications s&apos;appliquent immédiatement à tous les bracelets actifs.</p>
      </div>
    </div>
  );
}
