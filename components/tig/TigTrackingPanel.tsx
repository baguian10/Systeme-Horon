'use client';

import { useState, useTransition } from 'react';
import { Briefcase, CheckCircle2, Clock, Plus, CalendarDays } from 'lucide-react';
import {
  assignCaseTigSiteAction,
  updateTigHoursOrderedAction,
  addTigAttendanceAction,
} from '@/app/sigep/dashboard/tig-sites/actions';
import type { TigSite, TigAttendance } from '@/lib/supabase/types';

const IN = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500';

interface Props {
  caseId: string;
  tigSiteId: string | null;
  tigHoursOrdered: number | null;
  tigHoursCompleted: number;
  tigSites: TigSite[];
  attendance: TigAttendance[];
  canEdit: boolean;
}

export default function TigTrackingPanel({
  caseId,
  tigSiteId,
  tigHoursOrdered,
  tigHoursCompleted,
  tigSites,
  attendance,
  canEdit,
}: Props) {
  const [assignMsg, setAssignMsg] = useState<string | null>(null);
  const [hoursMsg,  setHoursMsg]  = useState<string | null>(null);
  const [pointMsg,  setPointMsg]  = useState<string | null>(null);
  const [showForm,  setShowForm]  = useState(false);
  const [pending,   start]        = useTransition();

  const pct = tigHoursOrdered
    ? Math.min(100, Math.round((tigHoursCompleted / tigHoursOrdered) * 100))
    : 0;
  const barColor = pct >= 100 ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-400' : 'bg-blue-500';

  function handleAssign(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setAssignMsg(null);
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const r = await assignCaseTigSiteAction(fd);
      setAssignMsg(r?.error ?? '✓ Site enregistré');
    });
  }

  function handleHours(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setHoursMsg(null);
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const r = await updateTigHoursOrderedAction(fd);
      setHoursMsg(r?.error ?? '✓ Heures enregistrées');
    });
  }

  function handleAddAttendance(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPointMsg(null);
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const r = await addTigAttendanceAction(fd);
      if (r?.error) { setPointMsg(r.error); return; }
      setPointMsg('✓ Pointage enregistré');
      setShowForm(false);
      (e.target as HTMLFormElement).reset();
    });
  }

  const activeSites = tigSites.filter((s) => s.is_active);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-5">
      <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
        <Briefcase className="w-4 h-4 text-emerald-600" />
        Suivi TIG
      </h3>

      {/* Site assignment */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Site d&apos;exécution</p>
        {canEdit ? (
          <form onSubmit={handleAssign} className="flex gap-2 items-start">
            <input type="hidden" name="case_id" value={caseId} />
            <select name="tig_site_id" defaultValue={tigSiteId ?? ''} className={`${IN} flex-1`}>
              <option value="">— Aucun site affecté —</option>
              {activeSites.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <button
              type="submit"
              disabled={pending}
              className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold disabled:opacity-40 whitespace-nowrap"
            >
              {pending ? '…' : 'Affecter'}
            </button>
          </form>
        ) : (
          <p className="text-sm text-gray-700">
            {tigSites.find((s) => s.id === tigSiteId)?.name ?? <span className="text-gray-400">Aucun site affecté</span>}
          </p>
        )}
        {assignMsg && (
          <p className={`text-xs ${assignMsg.startsWith('✓') ? 'text-emerald-600' : 'text-red-600'}`}>
            {assignMsg}
          </p>
        )}
      </div>

      {/* Hours ordered + progress */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Heures</p>

        {canEdit && (
          <form onSubmit={handleHours} className="flex gap-2 items-start">
            <input type="hidden" name="case_id" value={caseId} />
            <div className="flex items-center gap-2 flex-1">
              <input
                name="tig_hours_ordered"
                type="number"
                min={1}
                max={2000}
                required
                defaultValue={tigHoursOrdered ?? ''}
                placeholder="Heures ordonnées"
                className={`${IN} flex-1`}
              />
              <span className="text-xs text-gray-400 whitespace-nowrap">h ordonnées</span>
            </div>
            <button
              type="submit"
              disabled={pending}
              className="px-3 py-2 rounded-lg bg-gray-100 text-gray-700 text-sm font-semibold disabled:opacity-40"
            >
              {pending ? '…' : 'Enregistrer'}
            </button>
          </form>
        )}

        {hoursMsg && (
          <p className={`text-xs ${hoursMsg.startsWith('✓') ? 'text-emerald-600' : 'text-red-600'}`}>
            {hoursMsg}
          </p>
        )}

        {/* Progress bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-gray-500 flex items-center gap-1">
              <Clock className="w-3 h-3" /> Avancement
            </span>
            <span className="font-semibold text-gray-700">
              {tigHoursCompleted}h / {tigHoursOrdered ?? '?'}h
              {tigHoursOrdered ? ` (${pct}%)` : ''}
            </span>
          </div>
          {tigHoursOrdered && (
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${barColor}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          )}
          {pct >= 100 && (
            <p className="text-xs text-emerald-600 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> TIG accompli
            </p>
          )}
        </div>
      </div>

      {/* Attendance log */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Pointages ({attendance.length})
          </p>
          {canEdit && tigSiteId && (
            <button
              onClick={() => setShowForm((v) => !v)}
              className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:underline font-semibold"
            >
              <Plus className="w-3 h-3" /> Nouveau pointage
            </button>
          )}
        </div>

        {/* Add attendance form */}
        {showForm && (
          <form onSubmit={handleAddAttendance} className="border border-emerald-100 rounded-xl p-3 space-y-2 bg-emerald-50/40">
            <input type="hidden" name="case_id" value={caseId} />
            <input type="hidden" name="tig_site_id" value={tigSiteId ?? ''} />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-gray-500 mb-1">Date *</label>
                <input
                  name="session_date"
                  type="date"
                  required
                  defaultValue={new Date().toISOString().slice(0, 10)}
                  className={IN}
                />
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 mb-1">Heures effectuées *</label>
                <input
                  name="hours_worked"
                  type="number"
                  min={0.5}
                  max={24}
                  step={0.5}
                  required
                  placeholder="Ex : 4"
                  className={IN}
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] text-gray-500 mb-1">Notes superviseur</label>
              <input
                name="supervisor_notes"
                type="text"
                placeholder="Tâches effectuées, comportement…"
                className={IN}
              />
            </div>
            {pointMsg && (
              <p className={`text-xs ${pointMsg.startsWith('✓') ? 'text-emerald-600' : 'text-red-600'}`}>
                {pointMsg}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowForm(false)} className="text-xs text-gray-400 hover:text-gray-700">
                Annuler
              </button>
              <button
                type="submit"
                disabled={pending}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold disabled:opacity-40"
              >
                {pending ? '…' : 'Enregistrer'}
              </button>
            </div>
          </form>
        )}

        {/* Attendance list */}
        {attendance.length === 0 ? (
          <p className="text-xs text-gray-400">Aucun pointage enregistré.</p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {attendance.map((a) => (
              <li key={a.id} className="py-2 flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <CalendarDays className="w-3.5 h-3.5 text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-gray-800">
                      {new Date(a.session_date).toLocaleDateString('fr-FR', {
                        timeZone: 'UTC',
                        weekday: 'short',
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                    <span className="text-xs font-bold text-emerald-700 whitespace-nowrap">
                      {a.hours_worked}h
                    </span>
                  </div>
                  {a.supervisor_notes && (
                    <p className="text-[11px] text-gray-500 mt-0.5 leading-tight truncate">{a.supervisor_notes}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
