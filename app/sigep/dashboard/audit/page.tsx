import { redirect } from 'next/navigation';
import { ClipboardList } from 'lucide-react';
import { getSession } from '@/lib/auth/session';
import { canViewUsers } from '@/lib/auth/permissions';

export const metadata = { title: "Journal d'audit — SIGEP" };
export const revalidate = 0;

const MOCK_AUDIT = [
  { id: 1, action: 'CREATE_CASE',      table_name: 'cases',     user_name: 'Ibrahim Sawadogo',  record_id: 'c-0001', logged_at: new Date(Date.now() - 86400000 * 2).toISOString(),           details: 'Dossier OUAG-2024-0041 créé — Daouda Compaoré' },
  { id: 2, action: 'ADD_GEOFENCE',     table_name: 'geofences', user_name: 'Ibrahim Sawadogo',  record_id: 'g-0001', logged_at: new Date(Date.now() - 86400000 * 2 + 3600000).toISOString(), details: 'Géofence "Domicile — Dapoya" ajoutée au dossier OUAG-2024-0041' },
  { id: 3, action: 'ADD_GEOFENCE',     table_name: 'geofences', user_name: 'Ibrahim Sawadogo',  record_id: 'g-0002', logged_at: new Date(Date.now() - 86400000 * 2 + 7200000).toISOString(), details: 'Géofence "Zone interdite — TGI Ouagadougou" ajoutée' },
  { id: 4, action: 'CREATE_CASE',      table_name: 'cases',     user_name: 'Ibrahim Sawadogo',  record_id: 'c-0002', logged_at: new Date(Date.now() - 86400000 * 1.5).toISOString(),         details: 'Dossier OUAG-2024-0038 créé — Fatoumata Zongo' },
  { id: 5, action: 'RESOLVE_ALERT',    table_name: 'alerts',    user_name: 'Ibrahim Sawadogo',  record_id: 'al-0004', logged_at: new Date(Date.now() - 86400000).toISOString(),              details: 'Alerte HEALTH_CRITICAL résolue (dossier OUAG-2024-0041)' },
  { id: 6, action: 'UPDATE_STATUS',    table_name: 'cases',     user_name: 'Ibrahim Sawadogo',  record_id: 'c-0003', logged_at: new Date(Date.now() - 3600000 * 3).toISOString(),            details: 'Statut OUAG-2024-0035 → VIOLATION' },
  { id: 7, action: 'LOGIN',            table_name: null,         user_name: 'Aïssata Kaboré',   record_id: null,     logged_at: new Date(Date.now() - 1800000).toISOString(),                details: 'Connexion — accès SUPER_ADMIN' },
  { id: 8, action: 'LOGIN',            table_name: null,         user_name: 'Mariam Traoré',    record_id: null,     logged_at: new Date(Date.now() - 900000).toISOString(),                 details: 'Connexion — accès OPERATIONAL' },
];

const ACTION_COLORS: Record<string, string> = {
  CREATE_CASE:     'bg-blue-100 text-blue-700',
  ADD_GEOFENCE:    'bg-emerald-100 text-emerald-700',
  DELETE_GEOFENCE: 'bg-red-100 text-red-700',
  RESOLVE_ALERT:   'bg-green-100 text-green-700',
  UPDATE_STATUS:   'bg-amber-100 text-amber-700',
  LOGIN:           'bg-gray-100 text-gray-500',
  CREATE_USER:     'bg-purple-100 text-purple-700',
  DEACTIVATE_USER: 'bg-red-100 text-red-700',
  REACTIVATE_USER: 'bg-green-100 text-green-700',
};

export default async function AuditPage() {
  const session = await getSession();
  if (!session || !canViewUsers(session.role)) redirect('/sigep/dashboard');

  const isDemoMode = !process.env.NEXT_PUBLIC_SUPABASE_URL;

  type AuditRow = typeof MOCK_AUDIT[number];
  let entries: AuditRow[] = MOCK_AUDIT;

  if (!isDemoMode) {
    const { createAdminClient } = await import('@/lib/supabase/admin');
    const supabase = createAdminClient();
    if (supabase) {
      const { data } = await supabase
        .from('audit_log')
        .select('*, user:users(full_name)')
        .order('logged_at', { ascending: false })
        .limit(200);
      if (data) {
        entries = data.map((r) => ({
          id: r.id,
          action: r.action,
          table_name: r.table_name,
          user_name: (r.user as { full_name?: string } | null)?.full_name ?? 'Système',
          record_id: r.record_id,
          logged_at: r.logged_at,
          details: r.new_data ? JSON.stringify(r.new_data).slice(0, 100) : r.action,
        }));
      }
    }
  }

  function timeAgo(iso: string) {
    const d = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (d < 60) return `${d}s`;
    if (d < 3600) return `${Math.floor(d / 60)}min`;
    if (d < 86400) return `${Math.floor(d / 3600)}h`;
    return `${Math.floor(d / 86400)}j`;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Journal d'audit</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {entries.length} entrée{entries.length !== 1 ? 's' : ''} · accès SUPER_ADMIN uniquement
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-400 bg-white border border-gray-100 rounded-lg px-3 py-2">
          <ClipboardList className="w-3.5 h-3.5" />
          Immuable — lecture seule
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {entries.length === 0 ? (
          <p className="text-sm text-gray-400 px-5 py-8 text-center">Aucune entrée d'audit</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {entries.map((entry) => (
              <div key={entry.id} className="px-5 py-3.5 flex items-start gap-4">
                <div className="flex-shrink-0 pt-0.5">
                  <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide whitespace-nowrap ${ACTION_COLORS[entry.action] ?? 'bg-gray-100 text-gray-600'}`}>
                    {entry.action.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800 truncate">{entry.details}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs font-medium text-gray-500">{entry.user_name}</span>
                    {entry.table_name && (
                      <span className="text-[10px] text-gray-400 font-mono">{entry.table_name}</span>
                    )}
                    {entry.record_id && (
                      <span className="text-[10px] text-gray-300 font-mono">{String(entry.record_id).slice(0, 8)}</span>
                    )}
                  </div>
                </div>
                <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">{timeAgo(entry.logged_at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
