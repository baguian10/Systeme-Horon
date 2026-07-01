'use client';

import { useEffect, useState } from 'react';
import { Bell, BellOff, Loader2 } from 'lucide-react';

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export default function PushToggle() {
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Browser-capability detection post-hydration (avoids an SSR mismatch).
    const ok = typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && Boolean(VAPID_PUBLIC);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupported(ok);
    if (!ok) return;
    navigator.serviceWorker.getRegistration().then((reg) => {
      reg?.pushManager.getSubscription().then((sub) => setSubscribed(Boolean(sub)));
    });
  }, []);

  async function enable() {
    setBusy(true); setError(null);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { setError('Autorisation refusée par le navigateur.'); return; }
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC!) as unknown as BufferSource,
      });
      const res = await fetch('/api/push/subscribe', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sub),
      });
      if (!res.ok) { setError("Échec de l'enregistrement côté serveur."); return; }
      setSubscribed(true);
    } catch {
      setError('Activation impossible sur ce navigateur.');
    } finally { setBusy(false); }
  }

  async function disable() {
    setBusy(true); setError(null);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await fetch('/api/push/subscribe', {
          method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setSubscribed(false);
    } catch {
      setError('Désactivation impossible.');
    } finally { setBusy(false); }
  }

  if (!supported) {
    return (
      <div className="px-5 py-3 border-t border-gray-50 text-[11px] text-gray-400">
        Notifications push indisponibles sur ce navigateur{VAPID_PUBLIC ? '' : ' (non configurées côté serveur)'}.
      </div>
    );
  }

  return (
    <div className="px-5 py-3 border-t border-gray-50 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs font-medium text-gray-700">Notifications push (ce navigateur)</p>
        <p className="text-[10px] text-gray-400">{subscribed ? 'Activées sur cet appareil' : 'Recevez les alertes même hors de la page'}</p>
        {error && <p className="text-[10px] text-red-500 mt-0.5">{error}</p>}
      </div>
      <button
        onClick={subscribed ? disable : enable}
        disabled={busy}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 ${
          subscribed ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 'bg-emerald-600 text-white hover:bg-emerald-500'
        }`}
      >
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : subscribed ? <BellOff className="w-3.5 h-3.5" /> : <Bell className="w-3.5 h-3.5" />}
        {subscribed ? 'Désactiver' : 'Activer'}
      </button>
    </div>
  );
}
