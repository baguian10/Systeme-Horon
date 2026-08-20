'use client';

import { useEffect, useRef, useState } from 'react';
import { Navigation, NavigationOff, Loader2, AlertTriangle } from 'lucide-react';

// Partage de position de l'agent pendant une intervention.
//
// Le navigateur fournit la position ; on ne l'envoie qu'au plus une fois toutes
// les dix secondes, pour ne pas vider la batterie du téléphone ni saturer le
// réseau — sur le terrain, la connexion est ce qu'elle est.
const MIN_SEND_MS = 10_000;

export default function EscortSharing({ agentName }: { agentName: string }) {
  const [sharing, setSharing] = useState(false);
  const [pos, setPos] = useState<{ lat: number; lng: number; acc: number | null; at: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const watchId = useRef<number | null>(null);
  const lastSent = useRef(0);

  // Arrêt propre quand la page se ferme : une position d'agent qui traîne
  // laisserait croire qu'il est encore en intervention.
  useEffect(() => () => {
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    if (sharing) navigator.sendBeacon?.('/api/track/agent', new Blob([JSON.stringify({ stop: true })], { type: 'application/json' }));
  }, [sharing]);

  async function send(lat: number, lng: number, acc: number | null) {
    try {
      await fetch('/api/track/agent', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lng, accuracy: acc }),
      });
    } catch { /* le relevé suivant réessaiera */ }
  }

  function start() {
    if (!navigator.geolocation) { setError("Ce téléphone ne fournit pas de position."); return; }
    setBusy(true); setError(null);
    watchId.current = navigator.geolocation.watchPosition(
      (p) => {
        setBusy(false);
        const { latitude, longitude, accuracy } = p.coords;
        setPos({ lat: latitude, lng: longitude, acc: accuracy ?? null, at: Date.now() });
        setSharing(true);
        const now = Date.now();
        if (now - lastSent.current >= MIN_SEND_MS) {
          lastSent.current = now;
          send(latitude, longitude, accuracy ?? null);
        }
      },
      (e) => {
        setBusy(false); setSharing(false);
        setError(e.code === e.PERMISSION_DENIED
          ? "Position refusée — autorisez la localisation pour ce site."
          : "Position indisponible pour le moment.");
      },
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 20_000 },
    );
  }

  async function stop() {
    if (watchId.current !== null) { navigator.geolocation.clearWatch(watchId.current); watchId.current = null; }
    setSharing(false); setPos(null);
    await fetch('/api/track/agent', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stop: true }),
    }).catch(() => {});
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
      <p className="text-sm text-gray-700">Agent : <span className="font-semibold">{agentName}</span></p>

      {!sharing ? (
        <button
          onClick={start}
          disabled={busy}
          className="w-full inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl py-3 font-semibold disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Navigation className="w-5 h-5" />}
          {busy ? 'Recherche de la position…' : 'Démarrer le partage'}
        </button>
      ) : (
        <button
          onClick={stop}
          className="w-full inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 text-white rounded-xl py-3 font-semibold"
        >
          <NavigationOff className="w-5 h-5" /> Arrêter le partage
        </button>
      )}

      {error && (
        <p className="text-xs text-amber-700 flex items-start gap-1.5">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
        </p>
      )}

      {pos && (
        <div className="text-xs text-gray-600 space-y-0.5">
          <p className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Partage actif — envoi toutes les 10 s
          </p>
          <p className="font-mono text-[11px] text-gray-500">{pos.lat.toFixed(5)}, {pos.lng.toFixed(5)}</p>
          {pos.acc != null && <p className="text-gray-400">Précision du téléphone : ±{Math.round(pos.acc)} m</p>}
        </div>
      )}
    </div>
  );
}
