import { redirect } from 'next/navigation';
import {
  Wifi, WifiOff, Battery, Package, Bluetooth, Radio, Signal,
  Cpu, Timer, Zap, Globe, HardDrive, BatteryWarning, Thermometer, Activity,
} from 'lucide-react';
import { getSession } from '@/lib/auth/session';
import { canViewDevices, canConfigureHardware } from '@/lib/auth/permissions';
import { fetchAllDevices, fetchCases } from '@/lib/mock/helpers';

export const metadata = { title: 'Bracelets & Balises BLE — SIGEP' };
export const revalidate = 0;

export default async function DevicesPage() {
  const session = await getSession();
  if (!session || !canViewDevices(session.role)) redirect('/sigep/dashboard');

  const isHardwareAdmin = canConfigureHardware(session.role);

  const [devices, cases] = await Promise.all([
    fetchAllDevices(),
    fetchCases(session.role, session.id),
  ]);

  const caseMap = new Map(cases.map((c) => [c.id, c]));
  const online    = devices.filter((d) => d.is_online).length;
  const unassigned = devices.filter((d) => !d.case_id).length;

  function timeAgo(iso: string) {
    const d = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (d < 60) return `${d}s`;
    if (d < 3600) return `${Math.floor(d / 60)}min`;
    if (d < 86400) return `${Math.floor(d / 3600)}h`;
    return `${Math.floor(d / 86400)}j`;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Inventaire des dispositifs</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          {devices.length} bracelet{devices.length !== 1 ? 's' : ''} · {online} en ligne · {unassigned} non assigné{unassigned !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total',        value: devices.length,           color: 'text-gray-700',   bg: 'bg-gray-50 border-gray-100' },
          { label: 'En ligne',     value: online,                   color: 'text-green-700',  bg: 'bg-green-50 border-green-100' },
          { label: 'Hors ligne',   value: devices.length - online,  color: 'text-slate-600',  bg: 'bg-slate-50 border-slate-100' },
          { label: 'Non assignés', value: unassigned,               color: 'text-amber-700',  bg: 'bg-amber-50 border-amber-100' },
        ].map((t) => (
          <div key={t.label} className={`${t.bg} border rounded-2xl p-4 text-center`}>
            <p className={`text-2xl font-bold ${t.color}`}>{t.value}</p>
            <p className="text-xs text-gray-500 mt-1">{t.label}</p>
          </div>
        ))}
      </div>

      {/* Device table */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <Package className="w-4 h-4 text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-700">Bracelets électroniques</h3>
        </div>
        {devices.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-10 text-gray-400">
            <Package className="w-5 h-5" />
            <span className="text-sm">Aucun bracelet enregistré</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">IMEI</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Modèle</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Statut</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Batterie</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Firmware</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Dossier assigné</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Dernier contact</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {devices.map((d) => {
                  const assignedCase = d.case_id ? caseMap.get(d.case_id) : undefined;
                  const bat = d.battery_pct ?? 0;
                  return (
                    <tr key={d.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-5 py-3.5 font-mono text-xs text-gray-700">{d.imei}</td>
                      <td className="px-5 py-3.5 text-xs text-gray-600">{d.model}</td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${d.is_online ? 'text-green-600' : 'text-gray-400'}`}>
                          {d.is_online ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
                          {d.is_online ? 'En ligne' : 'Hors ligne'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${bat < 20 ? 'bg-red-400' : bat < 50 ? 'bg-amber-400' : 'bg-green-400'}`}
                              style={{ width: `${bat}%` }}
                            />
                          </div>
                          <span className={`text-xs font-medium ${bat < 20 ? 'text-red-600' : 'text-gray-600'}`}>
                            <Battery className="inline w-3 h-3 mr-0.5" />{bat}%
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-gray-400 font-mono">{d.firmware_ver ?? '—'}</td>
                      <td className="px-5 py-3.5">
                        {assignedCase ? (
                          <span className="font-mono text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">
                            {assignedCase.case_number}
                          </span>
                        ) : (
                          <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md">Disponible</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-gray-400">
                        {d.last_seen_at ? `${timeAgo(d.last_seen_at)} ago` : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ══ BLE BEACON CONFIG PANEL — SUPER_ADMIN only ═══════════════════════ */}
      {isHardwareAdmin && <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bluetooth className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-semibold text-gray-700">Configuration Beacon BLE</h3>
            <span className="ml-2 text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full uppercase tracking-wide">Assignation à domicile</span>
          </div>
          <span className="text-xs text-gray-400">Intégration API en attente</span>
        </div>

        <div className="p-6">
          <p className="text-sm text-gray-500 mb-6 leading-relaxed">
            Configurez les balises Bluetooth Low Energy (BLE) pour les ordonnances d&apos;assignation à domicile. Chaque balise est appairée avec le bracelet électronique du bénéficiaire pour assurer un suivi de présence ultra-précis en intérieur.
          </p>

          {/* Beacon form fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Adresse MAC de la balise</label>
              <input
                type="text"
                placeholder="AA:BB:CC:DD:EE:FF"
                disabled
                className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 text-gray-400 font-mono placeholder:text-gray-300 cursor-not-allowed"
              />
              <p className="text-[10px] text-gray-400">Identifiant matériel unique de la balise BLE</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">UUID du service</label>
              <input
                type="text"
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                disabled
                className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 text-gray-400 font-mono placeholder:text-gray-300 cursor-not-allowed"
              />
              <p className="text-[10px] text-gray-400">UUID standardisé du profil BLE SIGEP</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Portée de détection (mètres)</label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  placeholder="10"
                  min={5}
                  max={50}
                  disabled
                  className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 text-gray-400 placeholder:text-gray-300 cursor-not-allowed"
                />
                <div className="flex items-center gap-1.5 text-xs text-gray-400 whitespace-nowrap">
                  <Signal className="w-3.5 h-3.5" /> 5 – 50 m
                </div>
              </div>
              <p className="text-[10px] text-gray-400">Rayon dans lequel la présence est confirmée</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Puissance TX (dBm)</label>
              <input
                type="number"
                placeholder="-59"
                disabled
                className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 text-gray-400 placeholder:text-gray-300 cursor-not-allowed"
              />
              <p className="text-[10px] text-gray-400">Puissance d&apos;émission pour le calcul de proximité RSSI</p>
            </div>

            <div className="md:col-span-2 space-y-1.5">
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Dossier SIGEP associé</label>
              <input
                type="text"
                placeholder="OUAG-2024-XXXX"
                disabled
                className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 text-gray-400 font-mono placeholder:text-gray-300 cursor-not-allowed"
              />
            </div>

            <div className="md:col-span-2">
              <div className="flex items-center justify-between bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">
                <div className="flex items-center gap-2">
                  <Radio className="w-4 h-4 text-slate-400" />
                  <div>
                    <p className="text-sm font-semibold text-slate-700">Statut d&apos;appairage</p>
                    <p className="text-xs text-slate-400">Synchronisation bracelet ↔ balise BLE</p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-400 bg-gray-100 px-3 py-1.5 rounded-lg">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                  Non configuré
                </span>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-5 border-t border-gray-100 flex items-center justify-between">
            <p className="text-xs text-gray-400 italic">
              L&apos;intégration API BLE est en cours de déploiement. Ces champs seront actifs lors de la mise en production complète du module.
            </p>
            <button
              disabled
              className="px-4 py-2 rounded-xl bg-blue-600/30 text-blue-400 text-sm font-semibold cursor-not-allowed"
            >
              Enregistrer la configuration
            </button>
          </div>
        </div>
      </div>}

      {/* ══ GPS TRACKER DEEP CONFIG PANEL — SUPER_ADMIN only ════════════════ */}
      {isHardwareAdmin && <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
        {/* Panel header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-emerald-600" />
            <h3 className="text-sm font-semibold text-gray-700">Configuration Technique du Bracelet GPS</h3>
            <span className="ml-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full uppercase tracking-wide">
              Intégration API en attente
            </span>
          </div>
          <span className="text-xs text-gray-400">Paramètres matériels — lecture seule</span>
        </div>

        <div className="p-6 space-y-6">
          <p className="text-sm text-gray-500 leading-relaxed">
            Ces paramètres seront transmis directement au firmware du Dispositif Électronique Sécurisé via l&apos;API matérielle lors de la mise en production. Les valeurs ci-dessous représentent la configuration cible recommandée par défaut.
          </p>

          {/* ── 1. Fréquence de Transmission ──────────────────────────────── */}
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <Timer className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">Fréquence de transmission GPS</p>
                <p className="text-[10px] text-slate-500">Ping rate adaptatif pour optimiser la consommation batterie</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  En mouvement (secondes)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    defaultValue={30}
                    min={10}
                    max={300}
                    disabled
                    className="flex-1 px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 text-gray-400 cursor-not-allowed"
                  />
                  <span className="text-xs text-gray-400 whitespace-nowrap">sec</span>
                </div>
                <p className="text-[10px] text-gray-400">Accéléromètre actif → transmission fréquente</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  Immobile / veille (minutes)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    defaultValue={10}
                    min={1}
                    max={60}
                    disabled
                    className="flex-1 px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 text-gray-400 cursor-not-allowed"
                  />
                  <span className="text-xs text-gray-400 whitespace-nowrap">min</span>
                </div>
                <p className="text-[10px] text-gray-400">Aucune activité détectée → mode économie</p>
              </div>
            </div>
          </div>

          {/* ── 2. Sensibilité Anti-Sabotage ──────────────────────────────── */}
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-red-100 text-red-700 flex items-center justify-center">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">Sensibilité anti-sabotage</p>
                <p className="text-[10px] text-slate-500">Déclencheurs d&apos;alerte de niveau maximum en cas de manipulation</p>
              </div>
            </div>
            <div className="space-y-3">
              {[
                {
                  icon: <Activity className="w-4 h-4" />,
                  label: 'Coupure de la sangle (fibre optique)',
                  desc: 'Rupture du circuit optique intégré dans la sangle → alerte immédiate',
                  on: true,
                },
                {
                  icon: <Thermometer className="w-4 h-4" />,
                  label: 'Chute anormale de température',
                  desc: 'Baisse de > 15 °C en < 60 secondes → tentative de retrait par réfrigération',
                  on: true,
                },
                {
                  icon: <Zap className="w-4 h-4" />,
                  label: 'Choc violent (accéléromètre)',
                  desc: 'Impact > 4G détecté → tentative de destruction mécanique',
                  on: true,
                },
              ].map((item) => (
                <div key={item.label} className="flex items-start justify-between gap-4 bg-white rounded-xl px-4 py-3 border border-slate-100">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-red-50 text-red-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                      {item.icon}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-700 leading-tight">{item.label}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                  {/* Visual toggle — ON, disabled */}
                  <div className="flex-shrink-0 flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] font-bold text-emerald-600">ACTIF</span>
                    <div className="w-11 h-6 bg-emerald-500 rounded-full relative opacity-60 cursor-not-allowed">
                      <div className="absolute top-0.5 right-0.5 w-5 h-5 bg-white rounded-full shadow-sm" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── 3. Gestion Réseau ─────────────────────────────────────────── */}
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                <Globe className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">Gestion réseau &amp; bascule automatique</p>
                <p className="text-[10px] text-slate-500">Mode de connexion primaire et repli SMS en zone dégradée</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  Mode de connexion primaire
                </label>
                <select
                  disabled
                  className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 text-gray-400 cursor-not-allowed"
                >
                  <option>4G / LTE (Prioritaire)</option>
                  <option>3G / UMTS</option>
                  <option>2G / GPRS</option>
                </select>
                <p className="text-[10px] text-gray-400">Réseau cellulaire utilisé pour la transmission GPS</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  Bascule SMS automatique
                </label>
                <div className="flex items-center justify-between bg-white rounded-xl px-4 py-2.5 border border-slate-100 h-[42px]">
                  <p className="text-xs text-slate-600">Activer si données indisponibles</p>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-emerald-600">ACTIF</span>
                    <div className="w-11 h-6 bg-emerald-500 rounded-full relative opacity-60 cursor-not-allowed">
                      <div className="absolute top-0.5 right-0.5 w-5 h-5 bg-white rounded-full shadow-sm" />
                    </div>
                  </div>
                </div>
                <p className="text-[10px] text-gray-400">Repli SMS si perte réseau en zone rurale</p>
              </div>
            </div>
          </div>

          {/* ── 4. Seuils d'Alerte Batterie ───────────────────────────────── */}
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
                <BatteryWarning className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">Seuils d&apos;alerte batterie</p>
                <p className="text-[10px] text-slate-500">Déclencher des notifications automatiques aux agents selon le niveau de charge</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  Niveau 1 — Avertissement (%)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    defaultValue={20}
                    min={5}
                    max={50}
                    disabled
                    className="flex-1 px-3.5 py-2.5 text-sm border border-amber-200 rounded-xl bg-amber-50/50 text-amber-600 cursor-not-allowed font-semibold"
                  />
                  <span className="text-xs text-gray-400">%</span>
                </div>
                <p className="text-[10px] text-gray-400">Notification agent — recharge recommandée</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  Niveau 2 — Critique (%)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    defaultValue={10}
                    min={1}
                    max={20}
                    disabled
                    className="flex-1 px-3.5 py-2.5 text-sm border border-red-200 rounded-xl bg-red-50/50 text-red-600 cursor-not-allowed font-semibold"
                  />
                  <span className="text-xs text-gray-400">%</span>
                </div>
                <p className="text-[10px] text-gray-400">Alerte critique — intervention urgente requise</p>
              </div>
            </div>
            <div className="mt-3 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              <p className="text-[10px] text-amber-700 leading-relaxed">
                <strong>Note :</strong> En dessous du seuil critique, le dispositif bascule en mode survie (transmission GPS toutes les 5 minutes uniquement) et une alerte est transmise au juge responsable du dossier.
              </p>
            </div>
          </div>

          {/* ── 5. Mise en Cache Geofence ─────────────────────────────────── */}
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center">
                <HardDrive className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">Mise en cache des règles de géofencing</p>
                <p className="text-[10px] text-slate-500">Synchroniser les périmètres judiciaires dans la mémoire interne du bracelet pour application hors ligne</p>
              </div>
            </div>
            <div className="flex items-start justify-between gap-4 bg-white rounded-xl px-4 py-4 border border-slate-100">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-700">Cache géofence embarqué</p>
                <p className="text-xs text-slate-500 max-w-sm leading-relaxed">
                  Lorsqu&apos;activé, les règles de périmètre définies par le juge sont stockées dans la mémoire flash du dispositif. Le bracelet peut ainsi déclencher des alertes localement, même sans connexion réseau.
                </p>
                <div className="flex items-center gap-3 mt-2">
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                    <HardDrive className="w-3 h-3" />
                    Capacité : jusqu&apos;à 50 zones configurées simultanément
                  </div>
                </div>
              </div>
              {/* Visual toggle — OFF, disabled */}
              <div className="flex-shrink-0 flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-400">INACTIF</span>
                <div className="w-11 h-6 bg-slate-200 rounded-full relative opacity-60 cursor-not-allowed">
                  <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm" />
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="pt-2 border-t border-gray-100 flex items-center justify-between gap-4 flex-wrap">
            <p className="text-xs text-gray-400 italic max-w-lg">
              L&apos;intégration API matérielle est en cours de développement. Ces paramètres seront transmis au firmware du dispositif via l&apos;API SIGEP lors de la mise en production complète du module.
            </p>
            <button
              disabled
              className="px-4 py-2 rounded-xl bg-emerald-600/25 text-emerald-600/60 text-sm font-semibold cursor-not-allowed whitespace-nowrap"
            >
              Appliquer au dispositif
            </button>
          </div>
        </div>
      </div>}
    </div>
  );
}
