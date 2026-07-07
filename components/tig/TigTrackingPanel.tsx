'use client';

import { useState, useTransition } from 'react';
import { Briefcase, CheckCircle2, Clock, Plus, CalendarDays, Trash2 } from 'lucide-react';
import {
  assignCaseTigSiteAction,
  updateTigHoursOrderedAction,
  addTigAttendanceAction,
  deleteTigAttendanceAction,
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
  attendance: initialAttendance,
  canEdit,
}: Props) {
  // Controlled local state — updates immediately on action success, no page refresh needed
  const [siteId,       setSiteId]       = useState<string | null>(tigSiteId);
  const [hoursOrdered, setHoursOrdered] = useState<number | null>(tigHoursOrdered);
  const [records,      setRecords]      = useState<TigAttendance[]>(initialAttendance);

  const [assignErr, setAssignErr] = useState<string | null>(null);
  const [hoursErr,  setHoursErr]  = useState<string | null>(null);
  const [pointMsg,  setPointMsg]  = useState<string | null>(null);
  const [showForm,  setShowForm]  = useState(false);

  // Three independent transitions — no cross-blocking
  const [assignPending, startAssign] = useTransition();
  const [hoursPending,  startHours]  = useTransition();
  const [pointPending,  startPoint]  = useTransition();

  const hoursCompleted = records.reduce((acc, r) => acc + r.hours_worked, 0);
  const pct = hoursOrdered
    ? Math.min(100, Math.round((hoursCompleted / hoursOrdered) * 100))
    : 0;
  const barColor = pct >= 100 ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-400' : 'bg-blue-500';
  const today = new Date().toISOString().slice(0, 10);

  function handleAssign(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setAssignErr(null);
    const fd = new FormData(e.currentTarget);
    startAssign(async () => {
      const r = await assignCaseTigSiteAction(fd);
      if (r?.error) { setAssignErr(r.error); return; }
      setSiteId((fd.get('tig_site_id') as string) || null);
    });
  }

  function handleHours(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setHoursErr(null);
    const fd = new FormData(e.currentTarget);
    startHours(async () => {
      const r = await updateTigHoursOrderedAction(fd);
      if (r?.error) { setHoursErr(r.error); return; }
      const h = parseInt(fd.get('tig_hours_ordered') as string, 10);
      if (!isNaN(h)) setHoursOrdered(h);
    });
  }

  function handleAddAttendance(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPointMsg(null);
    const fd = new FormData(e.currentTarget);
    startPoint(async () => {
      const r = await addTigAttendanceAction(fd);
      if (r?.error || !r?.id) { setPointMsg(r?.error ?? 'Erreur inattendue'); return; }
      const newRecord: TigAttendance = {
        id: r.id,
        case_id: caseId,
        tig_site_id: fd.get('tig_site_id') as string,
        session_date: fd.get('session_date') as string,
        hours_worked: parseFloat(fd.get('hours_worked') as string),
        supervisor_notes: (fd.get('supervisor_notes') as string) || null,
        signed_by_id: null,
        created_by: null,
        created_at: new Date().toISOString(),
      };
      setRecords((prev) => [newRecord, ...prev]);
      setShowForm(false);
      (e.target as HTMLFormElement).reset();
    });
  }

  function handleDeleteRecord(id: string, hours: number) {
    if (!confirm('Supprimer ce pointage ?')) return;
    const fd = new FormData();
    fd.set('id', id);
    fd.set('case_id', caseId);
    startPoint(async () => {
      const r = await deleteTigAttendanceAction(fd);
      if (r?.error) { setPointMsg(r.error); return; }
      setRecords((prev) => prev.filter((a) => a.id !== id));
    });
  }

  const activeSites = tigSites.filter((s) => s.is_active);
  const totalSessions = records.length;
  const sessionTotal = records.reduce((acc, r) => acc + r.hours_worked, 0);

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
            <select
              name="tig_site_id"
              value={siteId ?? ''}
              onChange={(e) => setSiteId(e.target.value || null)}
              className={`${IN} flex-1`}
            >
              <option value="">— Aucun site affecté —</option>
              {activeSites.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <button
              type="submit"
              disabled={assignPending}
              className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold disabled:opacity-40 whitespace-nowrap"
            >
              {assignPending ? '…' : 'Affecter'}
            </button>
          </form>
        ) : (
          <p className="text-sm text-gray-700">
            {tigSites.find((s) => s.id === siteId)?.name ?? <span className="text-gray-400">Aucun site affecté</span>}
          </p>
        )}
        {assignErr && <p className="text-xs text-red-600">{assignErr}</p>}
      </div>

      {/* Hours ordered + progress */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Heures</p>

        {canEdit && (
          <form onSubmit={handleHours} className="flex gap-2 items-center">
            <input type="hidden" name="case_id" value={caseId} />
            <input
              name="tig_hours_ordered"
              type="number"
              min={1}
              max={2000}
              required
              value={hoursOrdered ?? ''}
              onChange={(e) => setHoursOrdered(parseInt(e.target.value, 10) || null)}
              placeholder="Heures ordonnées"
              className={`${IN} flex-1`}
            />
            <span className="text-xs text-gray-400 whitespace-nowrap">h ordonnées</span>
            <button
              type="submit"
              disabled={hoursPending}
              className="px-3 py-2 rounded-lg bg-gray-100 text-gray-700 text-sm font-semibold disabled:opacity-40"
            >
              {hoursPending ? '…' : 'Enregistrer'}
            </button>
          </form>
        )}
        {hoursErr && <p className="text-xs text-red-600">{hoursErr}</p>}

        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-gray-500 flex items-center gap-1">
              <Clock className="w-3 h-3" /> Avancement
            </span>
            <span className="font-semibold text-gray-700">
              {hoursCompleted}h / {hoursOrdered ?? '?'}h
              {hoursOrdered ? ` (${pct}%)` : ''}
            </span>
          </div>
          {hoursOrdered && (
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
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
            Pointages
            {totalSessions > 0 && (
              <span className="font-normal ml-1">
                — {totalSessions} session{totalSessions > 1 ? 's' : ''} · {sessionTotal}h total
              </span>
            )}
          </p>
          {canEdit && siteId && (
            <button
              onClick={() => setShowForm((v) => !v)}
              className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:underline font-semibold"
            >
              <Plus className="w-3 h-3" /> Nouveau pointage
            </button>
          )}
        </div>

        {canEdit && !siteId && (
          <p className="text-xs text-amber-600">Affectez un site pour pouvoir enregistrer des pointages.</p>
        )}

        {showForm && siteId && (
          <form onSubmit={handleAddAttendance} className="border border-emerald-100 rounded-xl p-3 space-y-2 bg-emerald-50/40">
            <input type="hidden" name="case_id" value={caseId} />
            <input type="hidden" name="tig_site_id" value={siteId} />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-gray-500 mb-1">Date *</label>
                <input
                  name="session_date"
                  type="date"
                  required
                  max={today}
                  defaultValue={today}
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
              <textarea
                name="supervisor_notes"
                rows={2}
                placeholder="Tâches effectuées, comportement, incidents…"
                className={`${IN} resize-none`}
              />
            </div>
            {pointMsg && (
              <p className="text-xs text-red-600">{pointMsg}</p>
            )}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowForm(false)} className="text-xs text-gray-400 hover:text-gray-700">
                Annuler
              </button>
              <button
                type="submit"
                disabled={pointPending}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold disabled:opacity-40"
              >
                {pointPending ? '…' : 'Enregistrer'}
              </button>
            </div>
          </form>
        )}

        {records.length === 0 ? (
          <p className="text-xs text-gray-400">Aucun pointage enregistré.</p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {records.map((a) => (
              <li key={a.id} className="py-2 flex items-start gap-3 group">
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
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-emerald-700 whitespace-nowrap">
                        {a.hours_worked}h
                      </span>
                      {canEdit && (
                        <button
                          onClick={() => handleDeleteRecord(a.id, a.hours_worked)}
                          disabled={pointPending}
                          title="Supprimer ce pointage"
                          className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 disabled:opacity-40 transition-opacity"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                  {a.supervisor_notes && (
                    <p className="text-[11px] text-gray-500 mt-0.5 leading-tight">{a.supervisor_notes}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        {pointMsg && !showForm && (
          <p className="text-xs text-red-600">{pointMsg}</p>
        )}
      </div>
    </div>
  );
}
