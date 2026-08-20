'use client';

import { useState } from 'react';
import { ShieldCheck, ShieldAlert, Loader2, FileCheck2 } from 'lucide-react';

interface Verdict {
  checked: number; sealed: number; unsealed: number; intact: boolean;
  brokenAt: { seq: number | null; recordedAt: string; reason: string } | null;
  verifiedAt: string; verifiedBy: string;
  error?: string;
}

// Vérification du scellé — le geste qu'un magistrat pose avant de s'appuyer sur
// un relevé de positions. Rien n'est vérifié en continu : c'est une demande
// explicite, horodatée et attribuée, comme un contrôle d'huissier.
export default function SealVerifyPanel({ caseId }: { caseId: string }) {
  const [busy, setBusy] = useState(false);
  const [v, setV] = useState<Verdict | null>(null);

  async function verify() {
    setBusy(true); setV(null);
    try {
      const r = await fetch(`/api/track/verify?caseId=${encodeURIComponent(caseId)}`, { cache: 'no-store' });
      const d = await r.json();
      setV(r.ok ? d : { ...d, checked: 0, sealed: 0, unsealed: 0, intact: false, brokenAt: null, verifiedAt: '', verifiedBy: '' });
    } catch {
      setV({ checked: 0, sealed: 0, unsealed: 0, intact: false, brokenAt: null, verifiedAt: '', verifiedBy: '', error: 'Erreur réseau' });
    } finally { setBusy(false); }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <h3 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
        <FileCheck2 className="w-4 h-4 text-gray-400" /> Intégrité du relevé de positions
      </h3>
      <p className="text-[11px] text-gray-500 mb-3">
        Chaque position porte l&apos;empreinte de la précédente. Une ligne modifiée, supprimée ou
        intercalée rompt la chaîne, et la rupture est datée.
      </p>

      <button
        onClick={verify}
        disabled={busy}
        data-tip="Recalculer la chaîne d'empreintes et dater le contrôle"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-900 text-white text-xs font-semibold disabled:opacity-50"
      >
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
        {busy ? 'Vérification…' : 'Vérifier la chaîne'}
      </button>

      {v && (
        <div className="mt-3 text-xs space-y-1">
          {v.error ? (
            <p className="text-amber-600">{v.error}</p>
          ) : v.intact ? (
            <>
              <p className="text-emerald-700 font-semibold flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" /> Chaîne intacte — {v.sealed} position{v.sealed > 1 ? 's' : ''} scellée{v.sealed > 1 ? 's' : ''}
              </p>
              {v.unsealed > 0 && (
                <p className="text-gray-500">
                  {v.unsealed} relevé{v.unsealed > 1 ? 's' : ''} antérieur{v.unsealed > 1 ? 's' : ''} au scellé — hors vérification, et non suspect pour autant.
                </p>
              )}
            </>
          ) : (
            <>
              <p className="text-red-700 font-semibold flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4" /> Chaîne rompue
              </p>
              {v.brokenAt && (
                <p className="text-red-600">
                  Première rupture au relevé du{' '}
                  {new Date(v.brokenAt.recordedAt).toLocaleString('fr-FR', { timeZone: 'Africa/Ouagadougou' })}
                  {v.brokenAt.seq != null && ` (rang ${v.brokenAt.seq})`} — {v.brokenAt.reason}.
                </p>
              )}
            </>
          )}
          {v.verifiedAt && (
            <p className="text-gray-400">
              Contrôle effectué le {new Date(v.verifiedAt).toLocaleString('fr-FR', { timeZone: 'Africa/Ouagadougou' })} par {v.verifiedBy}.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
