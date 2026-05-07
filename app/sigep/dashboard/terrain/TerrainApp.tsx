'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Wifi, WifiOff, RefreshCw, Battery, AlertTriangle,
  MapPin, Calendar, CheckCircle2, Clock, Send, Smartphone,
  ChevronDown, ChevronUp, Shield,
} from 'lucide-react';

type CasePayload = {
  id: string; case_number: string; status: string;
  individual_name: string; individual_address: string;
  device_online: boolean; battery_pct: number | null;
  alert_count: number; last_lat: number | null; last_lng: number | null;
};
type AlertPayload = {
  id: string; case_id: string; alert_type: string;
  severity: number; description: string | null; triggered_at: string;
};
type AgendaPayload = {
  id: string; case_number: string; individual_name: string;
  obligation_type: string; title: string; scheduled_date: string;
  start_time: string | null; location: string | null; is_confirmed: boolean;
};
type UserPayload = { id: string; full_name: string; role: string; badge: string | null };

interface InitialData {
  cases: CasePayload[]; alerts: AlertPayload[];
  agenda: AgendaPayload[]; user: UserPayload; fetched_at: string;
}

interface QueuedAction {
  id: string; type: 'CHECK_IN' | 'JOURNAL' | 'ALERT_ACK';
  case_id: string; case_number: string;
  payload: Record<string, string>;
  queued_at: string;
}

const CACHE_KEY = 'sigep_terrain_cache';
const QUEUE_KEY = 'sigep_terrain_queue';

const OBL_COLORS: Record<string, string> = {
  TIG_SHIFT: 'bg-emerald-100 text-emerald-700', CURFEW_CHECK: 'bg-blue-100 text-blue-700',
  COURT_DATE: 'bg-purple-100 text-purple-700',  MONITORING_VISIT: 'bg-amber-100 text-amber-700',
};
const OBL_LABELS: Record<string, string> = {
  TIG_SHIFT: 'Prestation TIG', CURFEW_CHECK: 'Couvre-feu',
  COURT_DATE: 'Audience',       MONITORING_VISIT: 'Visite',
};
const ALERT_LABELS: Record<string, string> = {
  GEOFENCE_EXIT: 'Sortie zone', TAMPER_DETECTED: 'Anti-sabotage',
  BATTERY_LOW: 'Batterie',      SIGNAL_LOST: 'Signal perdu',
  PANIC_BUTTON: 'Urgence',      HEALTH_CRITICAL: 'Santé critique',
};

function timeAgo(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  return d < 60 ? `${d}min` : `${Math.floor(d / 60)}h`;
}

export default function TerrainApp({ initialData }: { initialData: InitialData }) {
  const [isOnline, setIsOnline]     = useState(true);
  const [data, setData]             = useState<InitialData>(initialData);
  const [queue, setQueue]           = useState<QueuedAction[]>([]);
  const [syncing, setSyncing]       = useState(false);
  const [syncMsg, setSyncMsg]       = useState('');
  const [expandedCase, setExpanded] = useState<string | null>(null);
  const [noteText, setNoteText]     = useState<Record<string, string>>({});
  const [activeTab, setActiveTab]   = useState<'cases' | 'alerts' | 'agenda'>('cases');

  // Track online/offline
  useEffect(() => {
    function onOnline()  { setIsOnline(true); }
    function onOffline() { setIsOnline(false); }
    setIsOnline(navigator.onLine);
    window.addEventListener('online',  onOnline);
    window.addEventListener('offline', onOffline);
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); };
  }, []);

  // Persist to localStorage on each data/queue change
  useEffect(() => {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch {}
  }, [data]);
  useEffect(() => {
    try { localStorage.setItem(QUEUE_KEY, JSON.stringify(queue)); } catch {}
  }, [queue]);

  // Load queue from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(QUEUE_KEY);
      if (saved) setQueue(JSON.parse(saved));
    } catch {}
  }, []);

  function queueAction(action: Omit<QueuedAction, 'id' | 'queued_at'>) {
    setQueue((prev) => [...prev, { ...action, id: `qa-${Date.now()}`, queued_at: new Date().toISOString() }]);
  }

  async function syncQueue() {
    if (!isOnline || queue.length === 0) return;
    setSyncing(true);
    setSyncMsg('');
    // Demo: just clear the queue after a short delay
    await new Promise((r) => setTimeout(r, 1200));
    setSyncing(false);
    setSyncMsg(`${queue.length} action${queue.length > 1 ? 's' : ''} synchronisée${queue.length > 1 ? 's' : ''}.`);
    setQueue([]);
    setTimeout(() => setSyncMsg(''), 4000);
  }

  function logCheckin(c: CasePayload) {
    queueAction({
      type: 'CHECK_IN', case_id: c.id, case_number: c.case_number,
      payload: { location: c.individual_address, timestamp: new Date().toISOString() },
    });
    setSyncMsg(isOnline ? 'Check-in envoyé.' : 'Check-in mis en file — synchronisation à la reconnexion.');
    setTimeout(() => setSyncMsg(''), 3000);
  }

  function logNote(c: CasePayload) {
    const content = noteText[c.id]?.trim();
    if (!content) return;
    queueAction({
      type: 'JOURNAL', case_id: c.id, case_number: c.case_number,
      payload: { content, entry_type: 'NEUTRAL', timestamp: new Date().toISOString() },
    });
    setNoteText((prev) => ({ ...prev, [c.id]: '' }));
    setSyncMsg(isOnline ? 'Note envoyée.' : 'Note mise en file — synchronisation à la reconnexion.');
    setTimeout(() => setSyncMsg(''), 3000);
  }

  const today = new Date().toISOString().slice(0, 10);
  const todayObs = data.agenda.filter((a) => a.scheduled_date === today);

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      {/* Status bar */}
      <div className={`rounded-2xl px-4 py-3 flex items-center justify-between gap-3 ${
        isOnline ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'
      }`}>
        <div className="flex items-center gap-2">
          {isOnline
            ? <Wifi className="w-4 h-4 text-emerald-600" />
            : <WifiOff className="w-4 h-4 text-red-600" />}
          <div>
            <p className={`text-sm font-semibold ${isOnline ? 'text-emerald-800' : 'text-red-800'}`}>
              {isOnline ? 'Connecté — Synchronisation active' : 'Mode hors-ligne — Données en cache'}
            </p>
            <p className="text-xs text-gray-500">
              Cache: {new Date(data.fetched_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              {queue.length > 0 && ` · ${queue.length} action${queue.length > 1 ? 's' : ''} en attente`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {syncMsg && <span className="text-xs text-emerald-700 font-medium">{syncMsg}</span>}
          {queue.length > 0 && isOnline && (
            <button
              onClick={syncQueue}
              disabled={syncing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-500 disabled:opacity-60 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Sync…' : `Sync (${queue.length})`}
            </button>
          )}
        </div>
      </div>

      {/* Agent identity */}
      <div className="bg-gray-900 rounded-2xl px-4 py-3 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center">
          <Shield className="w-4 h-4 text-white" />
        </div>
        <div>
          <p className="text-sm font-bold text-white">{data.user.full_name}</p>
          <p className="text-xs text-gray-400">{data.user.badge ?? data.user.role} · Mode terrain</p>
        </div>
        <Smartphone className="w-4 h-4 text-gray-600 ml-auto" />
      </div>

      {/* Today's agenda strip */}
      {todayObs.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50 flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-gray-400" />
            <p className="text-xs font-semibold text-gray-700">Aujourd&apos;hui ({todayObs.length} obligation{todayObs.length > 1 ? 's' : ''})</p>
          </div>
          <ul className="divide-y divide-gray-50">
            {todayObs.map((ob) => (
              <li key={ob.id} className="px-4 py-3 flex items-center gap-3">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${OBL_COLORS[ob.obligation_type] ?? 'bg-gray-100 text-gray-700'}`}>
                  {OBL_LABELS[ob.obligation_type] ?? ob.obligation_type}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{ob.title}</p>
                  <p className="text-xs text-gray-400">{ob.start_time ?? ''} · {ob.location ?? ''}</p>
                </div>
                {!ob.is_confirmed && (
                  <span className="text-[10px] text-amber-600 font-medium flex-shrink-0">À confirmer</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Tabs */}
      <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
        {([['cases', `Missions (${data.cases.length})`], ['alerts', `Alertes (${data.alerts.length})`], ['agenda', `Agenda (${data.agenda.length})`]] as const).map(([tab, label]) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Cases tab */}
      {activeTab === 'cases' && (
        <div className="space-y-3">
          {data.cases.length === 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 px-4 py-10 text-center text-sm text-gray-400">
              Aucune mission active
            </div>
          )}
          {data.cases.map((c) => {
            const isExpanded = expandedCase === c.id;
            return (
              <div key={c.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <button
                  onClick={() => setExpanded(isExpanded ? null : c.id)}
                  className="w-full px-4 py-4 flex items-center gap-3 text-left hover:bg-gray-50 transition-colors"
                >
                  {/* Status dot */}
                  <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${c.status === 'VIOLATION' ? 'bg-red-500 animate-pulse' : 'bg-emerald-400'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-gray-900 font-mono">{c.case_number}</p>
                      {c.alert_count > 0 && (
                        <span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-full">
                          {c.alert_count} alerte{c.alert_count > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 truncate">{c.individual_name}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {c.battery_pct !== null && (
                      <span className={`flex items-center gap-0.5 text-xs ${c.battery_pct < 20 ? 'text-red-500' : 'text-gray-400'}`}>
                        <Battery className="w-3 h-3" /> {c.battery_pct}%
                      </span>
                    )}
                    {c.device_online
                      ? <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                      : <WifiOff className="w-3.5 h-3.5 text-gray-300" />}
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-gray-50 px-4 py-4 space-y-4">
                    {/* Info */}
                    <div className="space-y-2 text-sm">
                      <div className="flex items-start gap-2 text-gray-600">
                        <MapPin className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                        <span className="text-xs">{c.individual_address}</span>
                      </div>
                      {c.last_lat && c.last_lng && (
                        <div className="flex items-center gap-2 text-gray-400 text-xs font-mono">
                          <MapPin className="w-3 h-3" />
                          GPS: {c.last_lat.toFixed(5)}, {c.last_lng.toFixed(5)}
                        </div>
                      )}
                    </div>

                    {/* Quick actions */}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => logCheckin(c)}
                        className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-500 transition-colors"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Check-in visite
                      </button>
                      <a
                        href={c.last_lat && c.last_lng
                          ? `https://www.openstreetmap.org/?mlat=${c.last_lat}&mlon=${c.last_lng}&zoom=16`
                          : `https://www.openstreetmap.org/search?query=${encodeURIComponent(c.individual_address)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-xs font-semibold hover:bg-gray-50 transition-colors"
                      >
                        <MapPin className="w-3.5 h-3.5" />
                        Naviguer
                      </a>
                    </div>

                    {/* Note rapide */}
                    <div>
                      <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Note rapide</label>
                      <div className="flex gap-2">
                        <textarea
                          rows={2}
                          value={noteText[c.id] ?? ''}
                          onChange={(e) => setNoteText((prev) => ({ ...prev, [c.id]: e.target.value }))}
                          placeholder="Observation terrain…"
                          className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                        />
                        <button
                          onClick={() => logNote(c)}
                          disabled={!noteText[c.id]?.trim()}
                          className="w-9 rounded-xl bg-gray-900 text-white flex items-center justify-center hover:bg-gray-700 disabled:opacity-40 transition-colors self-end"
                        >
                          <Send className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      {!isOnline && (
                        <p className="text-[10px] text-amber-600 mt-1 flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Mise en file — sync à la reconnexion
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Alerts tab */}
      {activeTab === 'alerts' && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          {data.alerts.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-gray-400 flex flex-col items-center gap-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-200" />
              Aucune alerte active
            </div>
          ) : (
            <ul className="divide-y divide-gray-50">
              {data.alerts.map((a) => (
                <li key={a.id} className="px-4 py-3 flex items-start gap-3">
                  <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${a.severity >= 4 ? 'bg-red-500' : a.severity >= 3 ? 'bg-orange-400' : 'bg-amber-400'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-bold text-gray-800">{ALERT_LABELS[a.alert_type] ?? a.alert_type}</span>
                      <span className="text-[10px] font-mono text-gray-400">{timeAgo(a.triggered_at)}</span>
                    </div>
                    <p className="text-xs text-gray-500 truncate">{a.description}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Agenda tab */}
      {activeTab === 'agenda' && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          {data.agenda.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-gray-400">Aucune obligation planifiée</div>
          ) : (
            <ul className="divide-y divide-gray-50">
              {data.agenda.map((ob) => {
                const obDate = new Date(ob.scheduled_date + 'T00:00:00');
                const isToday2 = ob.scheduled_date === today;
                return (
                  <li key={ob.id} className="px-4 py-3 flex items-center gap-3">
                    <div className={`text-center w-10 rounded-xl py-1.5 flex-shrink-0 ${isToday2 ? 'bg-emerald-600 text-white' : 'bg-gray-50 text-gray-700'}`}>
                      <p className="text-[9px] font-semibold uppercase">{['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'][obDate.getDay()]}</p>
                      <p className="text-sm font-bold leading-tight">{obDate.getDate()}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${OBL_COLORS[ob.obligation_type] ?? 'bg-gray-100 text-gray-700'}`}>
                        {OBL_LABELS[ob.obligation_type] ?? ob.obligation_type}
                      </span>
                      <p className="text-sm font-medium text-gray-900 mt-0.5 truncate">{ob.title}</p>
                      <p className="text-xs text-gray-400">{ob.start_time ?? ''} · {ob.location ?? ''}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* Queued actions */}
      {queue.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-4">
          <p className="text-xs font-semibold text-amber-800 mb-2 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            {queue.length} action{queue.length > 1 ? 's' : ''} en attente de synchronisation
          </p>
          <ul className="space-y-1">
            {queue.map((qa) => (
              <li key={qa.id} className="text-[10px] text-amber-700 flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-amber-500" />
                {qa.type === 'CHECK_IN' ? 'Check-in' : qa.type === 'JOURNAL' ? 'Note journal' : 'Acquittement alerte'} — {qa.case_number}
              </li>
            ))}
          </ul>
          {isOnline && (
            <button onClick={syncQueue} disabled={syncing} className="mt-3 w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-amber-600 text-white text-xs font-semibold hover:bg-amber-500 disabled:opacity-60">
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Synchronisation…' : 'Synchroniser maintenant'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
