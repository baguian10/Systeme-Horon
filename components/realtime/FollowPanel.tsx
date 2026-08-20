'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  X, MapPin, Phone, FolderOpen, Radio, Battery, Lock, Unlock,
  Gavel, Clock, ShieldAlert, Loader2, CircleDot,
} from 'lucide-react';
import type { CaseCtx } from './MonitoringConsole';

// Fiche de suivi — ce qu'un opérateur doit avoir sous les yeux quand il suit
// quelqu'un : qui, sous quelle mesure, dans quel état, et les gestes immédiats.
// Tout vient du rendu serveur : la fiche s'ouvre sans requête, ce qui compte
// quand on passe d'un dossier à l'autre pendant un incident.

const RISK_LABEL: Record<string, { txt: string; cls: string }> = {
  LOW:    { txt: 'Risque faible', cls: 'bg-emerald-50 text-emerald-700' },
  MEDIUM: { txt: 'Risque moyen',  cls: 'bg-amber-50 text-amber-700' },
  HIGH:   { txt: 'Risque élevé',  cls: 'bg-red-50 text-red-700' },
};

const MEASURE_LABEL: Record<string, string> = {
  ASSIGNATION_DOMICILE: 'Assignation à domicile',
  DETENTION_DOMICILE: 'Détention à domicile',
  TIG: 'Travail d’intérêt général',
  COUVRE_FEU: 'Couvre-feu',
  INTERDICTION_ZONE: 'Interdiction de zone',
  LIBERTE_SURVEILLEE: 'Liberté surveillée',
};

function ago(iso: string | null | undefined): string {
  if (!iso) return '—';
  const s = Math.floor((Date.now() - Date.parse(iso)) / 1000);
  if (s < 60) return `${s} s`;
  if (s < 3600) return `${Math.floor(s / 60)} min`;
  if (s < 86400) return `${Math.floor(s / 3600)} h`;
  return `${Math.floor(s / 86400)} j`;
}

function date(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', { timeZone: 'Africa/Ouagadougou', day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function FollowPanel({
  caseId, ctx, crisis, onClose, onLocate, onIncident,
}: {
  caseId: string;
  ctx: CaseCtx;
  crisis: boolean;
  onClose: () => void;
  onLocate: (imei: string) => Promise<string | void> | void;
  onIncident: (caseId: string) => void;
}) {
  const [locating, setLocating] = useState(false);
  const [locateMsg, setLocateMsg] = useState<string | null>(null);

  const risk = ctx.risk ? RISK_LABEL[ctx.risk] : null;
  const fixAge = ctx.lastFixAt ? (Date.now() - Date.parse(ctx.lastFixAt)) / 1000 : null;
  const fixStale = fixAge != null && fixAge > 300;

  const shell = crisis ? 'bg-slate-900/95 border-slate-700 text-slate-200' : 'bg-white/95 border-gray-200 text-gray-800';
  const muted = crisis ? 'text-slate-400' : 'text-gray-500';
  const rowLabel = `text-[10px] uppercase tracking-wide ${muted}`;

  async function doLocate() {
    if (!ctx.imei) return;
    setLocating(true); setLocateMsg(null);
    try {
      const r = await onLocate(ctx.imei);
      if (typeof r === 'string') setLocateMsg(r);
    } finally { setLocating(false); }
  }

  return (
    <div className={`absolute top-3 right-3 bottom-3 z-[1100] w-[19rem] max-w-[calc(100%-1.5rem)] overflow-y-auto rounded-2xl border backdrop-blur-sm shadow-xl ${shell}`}>
      <div className="sticky top-0 flex items-start justify-between gap-2 px-3.5 py-3 border-b border-inherit backdrop-blur-sm">
        <div className="min-w-0">
          <p className="font-semibold truncate">{ctx.label}</p>
          <p className={`text-[11px] truncate ${muted}`}>{ctx.caseNumber ?? caseId.slice(0, 8)}</p>
        </div>
        <button onClick={onClose} data-tip="Fermer la fiche et cesser le suivi" className={`shrink-0 ${muted} hover:text-red-500`}>
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="px-3.5 py-3 space-y-3.5 text-xs">
        {/* Badges d'état */}
        <div className="flex flex-wrap gap-1.5">
          {risk && <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${risk.cls}`}>{risk.txt}</span>}
          {ctx.status === 'VIOLATION' && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-700 inline-flex items-center gap-1">
              <ShieldAlert className="w-3 h-3" /> En violation
            </span>
          )}
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold inline-flex items-center gap-1 ${ctx.online ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
            <CircleDot className="w-3 h-3" /> {ctx.online ? 'En ligne' : 'Hors ligne'}
          </span>
          {ctx.worn != null && (
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold inline-flex items-center gap-1 ${ctx.worn ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
              {ctx.worn ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />} {ctx.worn ? 'Sangle fermée' : 'Sangle ouverte'}
            </span>
          )}
        </div>

        {/* Mesure */}
        <div className="space-y-1">
          <p className={rowLabel}>Mesure</p>
          <p className="font-medium">{ctx.measureKind ? MEASURE_LABEL[ctx.measureKind] ?? ctx.measureKind : 'Non précisée'}</p>
          <p className={muted}>
            <Gavel className="w-3 h-3 inline mr-1" />{ctx.judgeName ?? 'Juge non renseigné'}
          </p>
          <p className={muted}>Du {date(ctx.startDate)} au {date(ctx.endDate)}</p>
          {ctx.curfew && <p className={muted}><Clock className="w-3 h-3 inline mr-1" />Couvre-feu {ctx.curfew}</p>}
          {ctx.tigOrdered != null && (
            <p className={muted}>TIG : {ctx.tigDone ?? 0} h sur {ctx.tigOrdered} h ordonnées</p>
          )}
          <p className={muted}>{ctx.zones ?? 0} zone(s) définie(s) · {ctx.alertCount ?? 0} alerte(s) ouverte(s)</p>
        </div>

        {/* Bracelet */}
        <div className="space-y-1 pt-2.5 border-t border-inherit">
          <p className={rowLabel}>Bracelet</p>
          <p className="font-mono text-[11px]">{ctx.imei ?? 'aucun bracelet'}</p>
          <p className={muted}>
            <Battery className="w-3 h-3 inline mr-1" />{ctx.battery != null ? `${ctx.battery} %` : '—'}
            <span className="mx-1.5">·</span>
            <Radio className="w-3 h-3 inline mr-1" />vu il y a {ago(ctx.lastSeenAt)}
          </p>
          <p className={fixStale ? 'text-amber-600 font-medium' : muted}>
            <MapPin className="w-3 h-3 inline mr-1" />
            Dernier point il y a {ago(ctx.lastFixAt)}{fixStale ? ' — position vieillissante' : ''}
          </p>
          {ctx.lat != null && ctx.lng != null && (
            <p className={`font-mono text-[10px] ${muted}`}>{ctx.lat.toFixed(5)}, {ctx.lng.toFixed(5)}</p>
          )}
        </div>

        {/* Gestes immédiats */}
        <div className="space-y-1.5 pt-2.5 border-t border-inherit">
          <p className={rowLabel}>Actions</p>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={doLocate}
              disabled={!ctx.imei || locating}
              data-tip="Demander une localisation GPS immédiate au bracelet"
              className="inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-500 disabled:opacity-40"
            >
              {locating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MapPin className="w-3.5 h-3.5" />} Localiser
            </button>
            <a
              href={ctx.sim ? `tel:${ctx.sim}` : undefined}
              data-tip={ctx.sim ? 'Appeler le bracelet — conversation avec le porteur' : 'Numéro SIM non renseigné'}
              className={`inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg font-semibold ${
                ctx.sim ? 'bg-emerald-600 text-white hover:bg-emerald-500' : 'bg-gray-100 text-gray-400 pointer-events-none'
              }`}
            >
              <Phone className="w-3.5 h-3.5" /> Appeler
            </a>
            <button
              onClick={() => onIncident(caseId)}
              data-tip="Ouvrir le panneau d'incident : trajet récent et rejeu"
              className={`inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg font-semibold ${crisis ? 'bg-slate-800 text-slate-200 hover:bg-slate-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              <ShieldAlert className="w-3.5 h-3.5" /> Incident
            </button>
            <Link
              href={`/sigep/dashboard/cases/${caseId}`}
              data-tip="Ouvrir le dossier complet"
              className={`inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg font-semibold ${crisis ? 'bg-slate-800 text-slate-200 hover:bg-slate-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              <FolderOpen className="w-3.5 h-3.5" /> Dossier
            </Link>
          </div>
          {ctx.deviceId && (
            <Link href={`/sigep/dashboard/devices/${ctx.deviceId}`} className={`block text-[10px] hover:underline ${muted}`}>
              Fiche du bracelet →
            </Link>
          )}
          {locateMsg && <p className={`text-[10px] ${muted}`}>{locateMsg}</p>}
        </div>
      </div>
    </div>
  );
}
