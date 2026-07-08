'use client';

import { useMemo, useState } from 'react';
import {
  CheckCircle, XCircle, Search, Download, ShieldCheck, Users as UsersIcon,
  KeyRound, Clock, CalendarX,
} from 'lucide-react';
import RoleBadge from '@/components/ui/RoleBadge';
import ToggleUserButton from '@/components/users/ToggleUserButton';
import ForceResetButton from '@/components/users/ForceResetButton';
import DeleteUserButton from '@/components/users/DeleteUserButton';
import EditPermissionsButton from '@/components/users/EditPermissionsButton';
import TransferCasesButton from '@/components/users/TransferCasesButton';
import type { User, UserRole } from '@/lib/supabase/types';

const DORMANT_MS = 30 * 86400000; // no sign-in for 30 days

const ROLE_LABEL: Record<UserRole, string> = {
  SUPER_ADMIN: 'Super Admin', ADMIN: 'Administrateur', STRATEGIC: 'Stratégique',
  JUDGE: 'Juge', OPERATIONAL: 'Agent',
};

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', { timeZone: 'Africa/Ouagadougou', day: '2-digit', month: '2-digit', year: 'numeric' });
}

function lastSeenLabel(iso: string | null | undefined, now: number): { label: string; dormant: boolean } {
  if (!iso) return { label: 'Jamais', dormant: true };
  const age = now - Date.parse(iso);
  const d = Math.floor(age / 86400000);
  const label = d === 0 ? "Aujourd'hui" : d === 1 ? 'Hier' : d < 30 ? `Il y a ${d} j` : fmtDate(iso);
  return { label, dormant: age > DORMANT_MS };
}

export default function UsersTable({ users, sessionId, activeJudges, authEnriched }: {
  users: User[];
  sessionId: string;
  activeJudges: { id: string; full_name: string }[];
  /** false when Supabase Auth metadata (last sign-in, MFA) is unavailable (demo). */
  authEnriched: boolean;
}) {
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [now] = useState(() => Date.now());

  const view = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter && u.role !== roleFilter) return false;
      const expired = u.expires_at != null && Date.parse(u.expires_at) < now;
      if (statusFilter === 'active' && (!u.is_active || expired)) return false;
      if (statusFilter === 'inactive' && u.is_active && !expired) return false;
      if (statusFilter === 'dormant' && !(u.is_active && lastSeenLabel(u.last_sign_in_at, now).dormant)) return false;
      if (statusFilter === 'nomfa' && (u.mfa_enabled || !u.is_active)) return false;
      if (q && !u.full_name.toLowerCase().includes(q)
        && !(u.badge_number ?? '').toLowerCase().includes(q)
        && !(u.jurisdiction ?? '').toLowerCase().includes(q)) return false;
      return true;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users, query, roleFilter, statusFilter]);

  const kpi = useMemo(() => {
    const actifs = users.filter((u) => u.is_active && !(u.expires_at && Date.parse(u.expires_at) < now));
    return {
      total: users.length,
      actifs: actifs.length,
      mfa: users.filter((u) => u.mfa_enabled).length,
      dormants: actifs.filter((u) => lastSeenLabel(u.last_sign_in_at, now).dormant).length,
      expires: users.filter((u) => u.expires_at != null && Date.parse(u.expires_at) < now).length,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users]);

  function exportCSV() {
    const esc = (s: string | null | undefined) => {
      const str = String(s ?? '');
      return /[",;\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
    };
    const lines = ['Nom;Rôle;Badge;Juridiction;Statut;2FA;Dernière connexion;Fin de mission;Créé le;Créé par;Motif désactivation'];
    for (const u of view) {
      const expired = u.expires_at != null && Date.parse(u.expires_at) < now;
      lines.push([
        u.full_name, ROLE_LABEL[u.role], u.badge_number, u.jurisdiction,
        expired ? 'Expiré' : u.is_active ? 'Actif' : 'Suspendu',
        authEnriched ? (u.mfa_enabled ? 'Oui' : 'Non') : '',
        u.last_sign_in_at ? fmtDate(u.last_sign_in_at) : 'Jamais',
        u.expires_at ? fmtDate(u.expires_at) : '',
        fmtDate(u.created_at), u.created_by_name ?? 'Système',
        u.deactivation_reason ?? '',
      ].map(esc).join(';'));
    }
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `registre_utilisateurs_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      {/* KPIs — registry health at a glance */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Comptes', v: kpi.total, cls: 'text-gray-800', f: '' },
          { label: 'Actifs', v: kpi.actifs, cls: 'text-emerald-600', f: 'active' },
          { label: '2FA activée', v: authEnriched ? `${kpi.mfa}/${kpi.total}` : '—', cls: kpi.mfa < kpi.total ? 'text-amber-600' : 'text-emerald-600', f: 'nomfa' },
          { label: 'Dormants (30 j+)', v: authEnriched ? kpi.dormants : '—', cls: kpi.dormants > 0 ? 'text-orange-600' : 'text-gray-400', f: 'dormant' },
          { label: 'Missions expirées', v: kpi.expires, cls: kpi.expires > 0 ? 'text-red-600' : 'text-gray-400', f: 'inactive' },
        ].map((k) => (
          <button
            key={k.label}
            onClick={() => setStatusFilter((cur) => cur === k.f ? '' : k.f)}
            className={`rounded-xl border px-3 py-2.5 text-center transition ${statusFilter === k.f && k.f ? 'border-gray-900 bg-gray-50' : 'border-gray-100 bg-white hover:bg-gray-50'}`}
          >
            <p className={`text-xl font-bold ${k.cls}`}>{k.v}</p>
            <p className="text-[10px] text-gray-500">{k.label}</p>
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
        {/* Toolbar */}
        <div className="px-5 py-3 border-b border-gray-50 flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[160px] max-w-[260px]">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Nom, badge, juridiction…"
              className="w-full pl-8 pr-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5">
            <option value="">Tous rôles</option>
            {(Object.keys(ROLE_LABEL) as UserRole[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5">
            <option value="">Tous statuts</option>
            <option value="active">Actifs</option>
            <option value="inactive">Suspendus / expirés</option>
            <option value="dormant">Dormants (30 j+)</option>
            <option value="nomfa">Sans 2FA</option>
          </select>
          <span className="text-[11px] text-gray-400 ml-auto">{view.length} compte{view.length !== 1 ? 's' : ''}</span>
          <button
            onClick={exportCSV}
            data-tip="Exporter le registre filtré en CSV"
            className="inline-flex items-center gap-1 text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-600 hover:bg-emerald-50 hover:text-emerald-700"
          >
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {['Nom', 'Rôle', 'Badge', 'Juridiction', '2FA', 'Dern. connexion', 'Fin mission', 'Créé par', 'Statut', ''].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {view.map((user) => {
                const seen = lastSeenLabel(user.last_sign_in_at, now);
                const expired = user.expires_at != null && Date.parse(user.expires_at) < now;
                return (
                  <tr key={user.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-gray-900">{user.full_name}</p>
                      {user.id === sessionId && <p className="text-[10px] text-emerald-600 font-medium">Vous</p>}
                      {!user.is_active && user.deactivation_reason && (
                        <p className="text-[10px] text-gray-400 italic max-w-[180px] truncate" title={user.deactivation_reason}>
                          Motif : {user.deactivation_reason}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3"><RoleBadge role={user.role} /></td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{user.badge_number ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 max-w-[140px] truncate">{user.jurisdiction ?? '—'}</td>
                    <td className="px-4 py-3">
                      {!authEnriched ? <span className="text-gray-300 text-xs">—</span>
                        : user.mfa_enabled
                          ? <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded-full"><ShieldCheck className="w-3 h-3" />2FA</span>
                          : <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-100 px-1.5 py-0.5 rounded-full" title="Compte sans double authentification"><KeyRound className="w-3 h-3" />Sans 2FA</span>}
                    </td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap">
                      <span className={seen.dormant && user.is_active ? 'text-orange-600 font-medium' : 'text-gray-500'}>
                        {authEnriched ? seen.label : '—'}
                      </span>
                      {authEnriched && seen.dormant && user.is_active && (
                        <span className="block text-[9px] text-orange-500 font-bold uppercase">Dormant</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap">
                      {user.expires_at ? (
                        <span className={`inline-flex items-center gap-1 ${expired ? 'text-red-600 font-bold' : 'text-gray-500'}`}>
                          <CalendarX className="w-3 h-3" /> {expired ? 'EXPIRÉ' : fmtDate(user.expires_at)}
                        </span>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{user.created_by_name ?? <span className="text-gray-300">Système</span>}</td>
                    <td className="px-4 py-3">
                      {expired
                        ? <span className="inline-flex items-center gap-1 text-xs text-red-600"><Clock className="w-3.5 h-3.5" />Expiré</span>
                        : user.is_active
                          ? <span className="inline-flex items-center gap-1 text-xs text-green-600"><CheckCircle className="w-3.5 h-3.5" />Actif</span>
                          : <span className="inline-flex items-center gap-1 text-xs text-gray-400"><XCircle className="w-3.5 h-3.5" />Suspendu</span>}
                    </td>
                    <td className="px-4 py-3">
                      {user.id !== sessionId && (
                        <div className="flex items-center justify-end gap-2 flex-wrap">
                          {user.role === 'ADMIN' && (
                            <EditPermissionsButton userId={user.id} name={user.full_name} current={user.permissions ?? []} />
                          )}
                          <ToggleUserButton userId={user.id} isActive={user.is_active} />
                          <ForceResetButton userId={user.id} />
                          {user.role === 'JUDGE' && (user.case_count ?? 0) > 0 ? (
                            <TransferCasesButton fromJudge={user.id} fromName={user.full_name} caseCount={user.case_count ?? 0} judges={activeJudges} />
                          ) : (
                            <DeleteUserButton userId={user.id} name={user.full_name} />
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {view.length === 0 && (
                <tr><td colSpan={10} className="px-5 py-10 text-center text-sm text-gray-400">
                  <UsersIcon className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                  Aucun compte ne correspond aux filtres
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
