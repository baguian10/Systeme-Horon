import { redirect } from 'next/navigation';
import { Calendar, MapPin, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { getSession } from '@/lib/auth/session';
import { canViewAgenda, canViewPII } from '@/lib/auth/permissions';
import { fetchAgenda } from '@/lib/mock/helpers';
import type { ObligationType } from '@/lib/supabase/types';

export const metadata = { title: 'Agenda des obligations — SIGEP' };
export const revalidate = 0;

const OBL_META: Record<ObligationType, { label: string; color: string; bg: string; border: string }> = {
  TIG_SHIFT:        { label: 'Prestation TIG',  color: 'text-emerald-700', bg: 'bg-emerald-50',  border: 'border-emerald-200' },
  CURFEW_CHECK:     { label: 'Couvre-feu',       color: 'text-blue-700',    bg: 'bg-blue-50',     border: 'border-blue-200' },
  COURT_DATE:       { label: 'Audience',          color: 'text-purple-700',  bg: 'bg-purple-50',   border: 'border-purple-200' },
  MONITORING_VISIT: { label: 'Visite de suivi',   color: 'text-amber-700',   bg: 'bg-amber-50',    border: 'border-amber-200' },
};

const DAY_FR = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const MONTH_FR = ['jan', 'fév', 'mar', 'avr', 'mai', 'jun', 'jul', 'aoû', 'sep', 'oct', 'nov', 'déc'];

export default async function AgendaPage() {
  const session = await getSession();
  if (!session || !canViewAgenda(session.role)) redirect('/sigep/dashboard');

  const showPII = canViewPII(session.role);
  const all = await fetchAgenda(session.role, session.id);

  // Build week range (Mon → Sun around today)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayOfWeek = today.getDay(); // 0=Sun
  const monday = new Date(today);
  monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));

  const weekDays: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    weekDays.push(d);
  }

  function toISO(d: Date) { return d.toISOString().slice(0, 10); }

  const upcoming = all
    .filter((a) => a.scheduled_date >= toISO(today))
    .sort((a, b) => {
      if (a.scheduled_date !== b.scheduled_date) return a.scheduled_date.localeCompare(b.scheduled_date);
      return (a.start_time ?? '').localeCompare(b.start_time ?? '');
    });

  const thisWeek = all.filter((a) => {
    const d = a.scheduled_date;
    return d >= toISO(weekDays[0]) && d <= toISO(weekDays[6]);
  });

  const confirmed   = upcoming.filter((a) => a.is_confirmed).length;
  const toConfirm   = upcoming.filter((a) => !a.is_confirmed).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Agenda des obligations</h2>
          <p className="text-sm text-gray-500 mt-0.5">Prestations TIG, couvre-feux, audiences et visites de suivi</p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="flex items-center gap-1.5 text-emerald-700 font-medium">
            <CheckCircle2 className="w-4 h-4" /> {confirmed} confirmées
          </span>
          {toConfirm > 0 && (
            <span className="flex items-center gap-1.5 text-amber-600 font-medium">
              <AlertCircle className="w-4 h-4" /> {toConfirm} à confirmer
            </span>
          )}
        </div>
      </div>

      {/* Weekly calendar strip */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-50">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Semaine du {weekDays[0].getDate()} {MONTH_FR[weekDays[0].getMonth()]} au {weekDays[6].getDate()} {MONTH_FR[weekDays[6].getMonth()]}
          </p>
        </div>
        <div className="grid grid-cols-7 divide-x divide-gray-50">
          {weekDays.map((day) => {
            const iso = toISO(day);
            const isToday = iso === toISO(today);
            const dayObs = thisWeek.filter((a) => a.scheduled_date === iso);
            return (
              <div key={iso} className={`p-3 min-h-[100px] ${isToday ? 'bg-emerald-50' : ''}`}>
                <div className={`text-center mb-2 ${isToday ? 'text-emerald-700' : 'text-gray-500'}`}>
                  <p className="text-[10px] font-medium uppercase">{DAY_FR[day.getDay()]}</p>
                  <p className={`text-lg font-bold ${isToday ? 'text-emerald-700' : 'text-gray-800'}`}>{day.getDate()}</p>
                </div>
                <div className="space-y-1">
                  {dayObs.map((ob) => {
                    const meta = OBL_META[ob.obligation_type];
                    return (
                      <div key={ob.id} className={`rounded px-1.5 py-0.5 text-[9px] font-bold truncate ${meta.bg} ${meta.color} border ${meta.border}`}>
                        {ob.start_time && <span>{ob.start_time} </span>}
                        {OBL_META[ob.obligation_type].label}
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
        {(Object.keys(OBL_META) as ObligationType[]).map((k) => {
          const m = OBL_META[k];
          return (
            <span key={k} className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg border ${m.bg} ${m.color} ${m.border}`}>
              {m.label}
            </span>
          );
        })}
      </div>

      {/* Upcoming list */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50">
          <h3 className="font-semibold text-gray-900 text-sm">Obligations à venir ({upcoming.length})</h3>
        </div>
        {upcoming.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-10">Aucune obligation planifiée</p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {upcoming.map((ob) => {
              const meta = OBL_META[ob.obligation_type];
              const obDate = new Date(ob.scheduled_date + 'T00:00:00');
              const isToday2 = ob.scheduled_date === toISO(today);
              return (
                <li key={ob.id} className="px-5 py-4 flex items-start gap-4">
                  {/* Date column */}
                  <div className={`flex-shrink-0 w-12 text-center rounded-xl py-2 ${isToday2 ? 'bg-emerald-600 text-white' : 'bg-gray-50 text-gray-700'}`}>
                    <p className="text-[10px] font-semibold uppercase">{DAY_FR[obDate.getDay()]}</p>
                    <p className="text-lg font-bold leading-tight">{obDate.getDate()}</p>
                    <p className="text-[10px]">{MONTH_FR[obDate.getMonth()]}</p>
                  </div>
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${meta.bg} ${meta.color} ${meta.border}`}>
                        {meta.label}
                      </span>
                      <span className="text-xs font-mono text-gray-400">{ob.case_number}</span>
                      {!ob.is_confirmed && (
                        <span className="text-[10px] font-medium text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
                          À confirmer
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-gray-900">{ob.title}</p>
                    {showPII && (
                      <p className="text-xs text-gray-500 mt-0.5">{ob.individual_name}</p>
                    )}
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
                  {/* Status dot */}
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-2 ${ob.is_confirmed ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                </li>
              );
            })}
          </ul>
        )}
      </div>

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
