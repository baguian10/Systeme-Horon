'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Calendar, MapPin, Clock, CheckCircle2, AlertCircle,
  ChevronLeft, ChevronRight, Plus, Trash2, X,
} from 'lucide-react';
import {
  confirmObligationAction,
  deleteObligationAction,
  createObligationAction,
} from '@/app/sigep/dashboard/agenda/actions';
import type { AgendaObligation, ObligationType } from '@/lib/supabase/types';
import type { CaseSelectOption } from '@/lib/mock/helpers';

const OBL_META: Record<ObligationType, { label: string; color: string; bg: string; border: string }> = {
  TIG_SHIFT:        { label: 'Prestation TIG',  color: 'text-emerald-700', bg: 'bg-emerald-50',  border: 'border-emerald-200' },
  CURFEW_CHECK:     { label: 'Couvre-feu',       color: 'text-blue-700',    bg: 'bg-blue-50',     border: 'border-blue-200' },
  COURT_DATE:       { label: 'Audience',          color: 'text-purple-700',  bg: 'bg-purple-50',   border: 'border-purple-200' },
  MONITORING_VISIT: { label: 'Visite de suivi',   color: 'text-amber-700',   bg: 'bg-amber-50',    border: 'border-amber-200' },
};

const DAY_FR   = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const MONTH_FR = ['jan', 'fév', 'mar', 'avr', 'mai', 'jun', 'jul', 'aoû', 'sep', 'oct', 'nov', 'déc'];
const PAGE_SIZE = 20;
const IN = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500';

function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface Props {
  obligations: AgendaObligation[];
  canManage: boolean;
  cases: CaseSelectOption[];
}

interface RowProps {
  ob: AgendaObligation;
  today: string;
  canManage: boolean;
  pending: boolean;
  dimPast?: boolean;
  onConfirm: (id: string, current: boolean) => void;
  onDelete: (id: string) => void;
}

function ObligationRow({ ob, today, canManage, pending, dimPast = false, onConfirm, onDelete }: RowProps) {
  const meta    = OBL_META[ob.obligation_type];
  const obDate  = new Date(ob.scheduled_date + 'T00:00:00');
  const isToday = ob.scheduled_date === today;

  return (
    <li className={`px-5 py-4 flex items-start gap-4 ${dimPast ? 'opacity-60' : ''}`}>
      <div className={`flex-shrink-0 w-12 text-center rounded-xl py-2 ${
        isToday ? 'bg-emerald-600 text-white' : dimPast ? 'bg-gray-100 text-gray-500' : 'bg-gray-50 text-gray-700'
      }`}>
        <p className="text-[10px] font-semibold uppercase">{DAY_FR[obDate.getDay()]}</p>
        <p className="text-lg font-bold leading-tight">{obDate.getDate()}</p>
        <p className="text-[10px]">{MONTH_FR[obDate.getMonth()]}</p>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${meta.bg} ${meta.color} ${meta.border}`}>
            {meta.label}
          </span>
          <Link
            href={`/sigep/dashboard/cases/${ob.case_id}`}
            className="text-xs font-mono text-blue-600 hover:underline"
          >
            {ob.case_number}
          </Link>
          {!ob.is_confirmed && (
            <span className="text-[10px] font-medium text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
              À confirmer
            </span>
          )}
          {ob.is_confirmed && dimPast && (
            <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full">
              Confirmée
            </span>
          )}
        </div>
        <p className="text-sm font-semibold text-gray-900">{ob.title}</p>
        <p className="text-xs text-gray-500 mt-0.5">{ob.individual_name}</p>
        <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-gray-400">
          {ob.start_time && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {ob.start_time}{ob.end_time ? ` – ${ob.end_time}` : ''}
            </span>
          )}
          {ob.location && (
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {ob.location}
            </span>
          )}
        </div>
      </div>

      {canManage ? (
        <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
          <button
            onClick={() => onConfirm(ob.id, ob.is_confirmed)}
            disabled={pending}
            title={ob.is_confirmed ? 'Marquer non confirmée' : 'Confirmer'}
            className={`p-1.5 rounded-lg transition-colors disabled:opacity-40 ${
              ob.is_confirmed
                ? 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100'
                : 'text-gray-300 hover:text-emerald-600 hover:bg-emerald-50'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(ob.id)}
            disabled={pending}
            title="Supprimer"
            className="p-1.5 rounded-lg text-gray-200 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-2.5 ${ob.is_confirmed ? 'bg-emerald-400' : 'bg-amber-400'}`} />
      )}
    </li>
  );
}

export default function AgendaClient({ obligations: initial, canManage, cases }: Props) {
  const router = useRouter();
  const [items,      setItems]      = useState<AgendaObligation[]>(initial);
  const [weekOffset, setWeekOffset] = useState(0);
  const [page,       setPage]       = useState(0);
  const [showForm,   setShowForm]   = useState(false);
  const [formMsg,    setFormMsg]    = useState<string | null>(null);
  const [pending,    startTransition] = useTransition();

  const today = localToday();

  // Week computation from offset
  const now    = new Date();
  const dow    = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1) + weekOffset * 7);
  monday.setHours(0, 0, 0, 0);

  const weekDays: Date[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });

  const weekStart = dateStr(weekDays[0]);
  const weekEnd   = dateStr(weekDays[6]);

  const upcoming = items
    .filter((a) => a.scheduled_date >= today)
    .sort((a, b) => {
      if (a.scheduled_date !== b.scheduled_date) return a.scheduled_date.localeCompare(b.scheduled_date);
      return (a.start_time ?? '').localeCompare(b.start_time ?? '');
    });

  const past = items
    .filter((a) => a.scheduled_date < today)
    .sort((a, b) => b.scheduled_date.localeCompare(a.scheduled_date));

  const thisWeek  = items.filter((a) => a.scheduled_date >= weekStart && a.scheduled_date <= weekEnd);
  const confirmed = upcoming.filter((a) => a.is_confirmed).length;
  const toConfirm = upcoming.filter((a) => !a.is_confirmed).length;
  const paginated  = upcoming.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(upcoming.length / PAGE_SIZE);

  function handleConfirm(id: string, current: boolean) {
    const fd = new FormData();
    fd.set('id', id);
    fd.set('is_confirmed', String(!current));
    startTransition(async () => {
      const r = await confirmObligationAction(fd);
      if (r?.error) { alert(r.error); return; }
      setItems((prev) => prev.map((a) => a.id === id ? { ...a, is_confirmed: !current } : a));
    });
  }

  function handleDelete(id: string) {
    if (!confirm('Supprimer cette obligation ?')) return;
    const fd = new FormData();
    fd.set('id', id);
    startTransition(async () => {
      const r = await deleteObligationAction(fd);
      if (r?.error) { alert(r.error); return; }
      setItems((prev) => prev.filter((a) => a.id !== id));
    });
  }

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormMsg(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const r = await createObligationAction(fd);
      if (r?.error) { setFormMsg(r.error); return; }
      setShowForm(false);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Agenda des obligations</h2>
          <p className="text-sm text-gray-500 mt-0.5">Prestations TIG, couvre-feux, audiences et visites de suivi</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="flex items-center gap-1.5 text-sm text-emerald-700 font-medium">
            <CheckCircle2 className="w-4 h-4" /> {confirmed} confirmée{confirmed !== 1 ? 's' : ''}
          </span>
          {toConfirm > 0 && (
            <span className="flex items-center gap-1.5 text-sm text-amber-600 font-medium">
              <AlertCircle className="w-4 h-4" /> {toConfirm} à confirmer
            </span>
          )}
          {canManage && (
            <button
              onClick={() => { setShowForm(true); setFormMsg(null); }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-colors shadow-sm shadow-emerald-200"
            >
              <Plus className="w-4 h-4" /> Nouvelle obligation
            </button>
          )}
        </div>
      </div>

      {/* Create modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900">Nouvelle obligation</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Dossier *</label>
                <select name="case_id" required className={IN}>
                  <option value="">— Sélectionner un dossier —</option>
                  {cases.map((c) => (
                    <option key={c.id} value={c.id}>{c.case_number} — {c.individual_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Type *</label>
                <select name="obligation_type" required className={IN}>
                  {(Object.entries(OBL_META) as [ObligationType, typeof OBL_META[ObligationType]][]).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Intitulé *</label>
                <input
                  name="title" type="text" required maxLength={200}
                  placeholder="Ex : Audition mensuelle — TGI Ouagadougou"
                  className={IN}
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Date *</label>
                  <input name="scheduled_date" type="date" required className={IN} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Début</label>
                  <input name="start_time" type="time" className={IN} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Fin</label>
                  <input name="end_time" type="time" className={IN} />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Lieu</label>
                <input name="location" type="text" maxLength={300} placeholder="Adresse ou lieu" className={IN} />
              </div>
              {formMsg && <p className="text-xs text-red-600">{formMsg}</p>}
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button" onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700"
                >
                  Annuler
                </button>
                <button
                  type="submit" disabled={pending}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold disabled:opacity-40"
                >
                  {pending ? '…' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Weekly calendar strip */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-50 flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Semaine du {weekDays[0].getDate()} {MONTH_FR[weekDays[0].getMonth()]}
            {' '}au {weekDays[6].getDate()} {MONTH_FR[weekDays[6].getMonth()]} {weekDays[6].getFullYear()}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setWeekOffset((o) => o - 1)}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Semaine précédente"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {weekOffset !== 0 && (
              <button
                onClick={() => setWeekOffset(0)}
                className="text-xs text-emerald-600 hover:underline px-2 py-1"
              >
                Auj.
              </button>
            )}
            <button
              onClick={() => setWeekOffset((o) => o + 1)}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Semaine suivante"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-7 divide-x divide-gray-50">
          {weekDays.map((day) => {
            const iso     = dateStr(day);
            const isToday = iso === today;
            const isPast  = iso < today;
            const dayObs  = thisWeek.filter((a) => a.scheduled_date === iso);
            return (
              <div
                key={iso}
                className={`p-2 min-h-[100px] ${isToday ? 'bg-emerald-50' : isPast ? 'bg-gray-50/60' : ''}`}
              >
                <div className={`text-center mb-2 ${isToday ? 'text-emerald-700' : 'text-gray-500'}`}>
                  <p className="text-[10px] font-medium uppercase">{DAY_FR[day.getDay()]}</p>
                  <p className={`text-lg font-bold leading-none mt-0.5 ${isToday ? 'text-emerald-700' : isPast ? 'text-gray-400' : 'text-gray-800'}`}>
                    {day.getDate()}
                  </p>
                </div>
                <div className="space-y-0.5">
                  {dayObs.map((ob) => {
                    const meta = OBL_META[ob.obligation_type];
                    return (
                      <div
                        key={ob.id}
                        title={`${ob.case_number} — ${ob.individual_name}\n${ob.title}`}
                        className={`rounded px-1 py-0.5 text-[9px] font-bold truncate cursor-default ${meta.bg} ${meta.color} border ${meta.border}`}
                      >
                        {ob.start_time && <span>{ob.start_time} </span>}
                        {ob.case_number}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {(Object.entries(OBL_META) as [ObligationType, typeof OBL_META[ObligationType]][]).map(([k, m]) => (
          <span
            key={k}
            className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg border ${m.bg} ${m.color} ${m.border}`}
          >
            {m.label}
          </span>
        ))}
      </div>

      {/* Upcoming list */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50">
          <h3 className="font-semibold text-gray-900 text-sm">Obligations à venir ({upcoming.length})</h3>
        </div>
        {upcoming.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-10">Aucune obligation planifiée</p>
        ) : (
          <>
            <ul className="divide-y divide-gray-50">
              {paginated.map((ob) => (
                <ObligationRow
                  key={ob.id}
                  ob={ob}
                  today={today}
                  canManage={canManage}
                  pending={pending}
                  onConfirm={handleConfirm}
                  onDelete={handleDelete}
                />
              ))}
            </ul>
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-gray-50">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="text-xs text-gray-500 hover:text-gray-800 disabled:opacity-30"
                >
                  ← Précédent
                </button>
                <span className="text-xs text-gray-400">{page + 1} / {totalPages}</span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="text-xs text-gray-500 hover:text-gray-800 disabled:opacity-30"
                >
                  Suivant →
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Past obligations */}
      {past.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50">
            <h3 className="font-semibold text-gray-500 text-sm">
              Obligations récentes — 14 derniers jours ({past.length})
            </h3>
          </div>
          <ul className="divide-y divide-gray-50">
            {past.slice(0, 10).map((ob) => (
              <ObligationRow
                key={ob.id}
                ob={ob}
                today={today}
                canManage={canManage}
                pending={pending}
                dimPast
                onConfirm={handleConfirm}
                onDelete={handleDelete}
              />
            ))}
          </ul>
          {past.length > 10 && (
            <p className="text-xs text-gray-400 text-center py-3 border-t border-gray-50">
              {past.length - 10} obligation{past.length - 10 > 1 ? 's' : ''} supplémentaire{past.length - 10 > 1 ? 's' : ''} non affichée{past.length - 10 > 1 ? 's' : ''}
            </p>
          )}
        </div>
      )}

      {/* Notice */}
      <div className="bg-blue-50 border border-blue-100 rounded-2xl px-5 py-4 flex items-start gap-3">
        <Calendar className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-blue-800">Obligations légales</p>
          <p className="text-xs text-blue-700 mt-0.5 leading-relaxed">
            Toute absence à une obligation doit être signalée dans les 24h au juge référent.
            Les absences non justifiées constituent un manquement pouvant entraîner une procédure de révocation.
          </p>
        </div>
      </div>
    </div>
  );
}
