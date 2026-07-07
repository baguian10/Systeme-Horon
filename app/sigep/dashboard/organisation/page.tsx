import { redirect } from 'next/navigation';
import { Building2 } from 'lucide-react';
import { getSession } from '@/lib/auth/session';
import { allow } from '@/lib/auth/permissions';
import type { Department, User } from '@/lib/supabase/types';
import DeleteDeptButton from '@/components/org/DeleteDeptButton';
import EditDeptButton from '@/components/org/EditDeptButton';
import OrgUserTable from '@/components/org/OrgUserTable';
import { createDepartmentAction } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Organisation — SIGEP' };

const TYPE_LABEL: Record<string, string> = {
  COURT: 'Cour / Tribunal',
  JURISDICTION: 'Juridiction',
  UNIT: 'Unité / Service',
};

async function loadData(): Promise<{
  depts: Department[];
  users: User[];
  caseCounts: Map<string, number>;
}> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    return { depts: [], users: [], caseCounts: new Map() };
  const { createAdminClient } = await import('@/lib/supabase/admin');
  const supabase = createAdminClient();
  if (!supabase) return { depts: [], users: [], caseCounts: new Map() };

  const [{ data: depts }, { data: users }, { data: caseRows }] = await Promise.all([
    supabase.from('departments').select('*').order('created_at', { ascending: true }),
    supabase.from('users').select('id, full_name, role, department_id').order('full_name', { ascending: true }),
    supabase.from('cases').select('department_id').not('department_id', 'is', null),
  ]);

  const caseCounts = new Map<string, number>();
  for (const c of (caseRows ?? []) as { department_id: string }[]) {
    caseCounts.set(c.department_id, (caseCounts.get(c.department_id) ?? 0) + 1);
  }

  return {
    depts: (depts ?? []) as Department[],
    users: (users ?? []) as User[],
    caseCounts,
  };
}

export default async function OrganisationPage() {
  const session = await getSession();
  if (!session) redirect('/sigep/login');
  if (!allow(session, session.role === 'SUPER_ADMIN', 'users.manage')) redirect('/sigep/dashboard');

  const { depts, users, caseCounts } = await loadData();
  const childrenOf = (id: string | null) => depts.filter((d) => d.parent_id === id);
  const membersOf = (id: string) => users.filter((u) => u.department_id === id);
  const deptSelectList = depts.map((d) => ({ id: d.id, name: d.name }));

  function renderTree(parentId: string | null, depth: number): React.ReactNode {
    const nodes = childrenOf(parentId);
    if (nodes.length === 0) return null;
    return (
      <ul className={depth > 0 ? 'ml-5 border-l border-gray-100 pl-3' : ''}>
        {nodes.map((d) => {
          const memberCount = membersOf(d.id).length;
          const caseCount = caseCounts.get(d.id) ?? 0;
          return (
            <li key={d.id} className="py-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <Building2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span className="font-medium text-gray-900 text-sm">{d.name}</span>
                <span className="text-[11px] text-gray-400">{TYPE_LABEL[d.type] ?? d.type}</span>
                <span className="text-[11px] text-gray-400">
                  · {memberCount} agent{memberCount !== 1 ? 's' : ''}
                  {caseCount > 0 && (
                    <> · <span className="text-blue-500 font-medium">{caseCount} dossier{caseCount !== 1 ? 's' : ''}</span></>
                  )}
                </span>
                <div className="ml-auto flex items-center gap-2">
                  <EditDeptButton dept={d} allDepts={depts} />
                  <DeleteDeptButton id={d.id} name={d.name} />
                </div>
              </div>
              {renderTree(d.id, depth + 1)}
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Organisation & juridictions</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Hiérarchie des cours, juridictions et unités · affectation des agents.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Tree */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-900 mb-3">Structure</h3>
          {depts.length === 0 ? (
            <p className="text-sm text-gray-400">Aucune entité. Créez la première à droite.</p>
          ) : (
            renderTree(null, 0)
          )}
        </div>

        {/* Create form */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-900 mb-3">Nouvelle entité</h3>
          <form action={createDepartmentAction} className="space-y-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Nom *</label>
              <input
                name="name"
                required
                placeholder="Ex : TGI de Ouagadougou"
                className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Type</label>
              <select name="type" defaultValue="COURT" className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm">
                <option value="COURT">Cour / Tribunal</option>
                <option value="JURISDICTION">Juridiction</option>
                <option value="UNIT">Unité / Service</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Rattachée à</label>
              <select name="parent_id" defaultValue="" className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm">
                <option value="">— Racine —</option>
                {depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <button
              type="submit"
              data-tip="Créer une cour, juridiction ou unité. Rattachez-la à une entité parente pour bâtir la hiérarchie."
              className="w-full bg-blue-600 text-white rounded-lg py-2 text-sm font-semibold hover:bg-blue-700"
            >
              Créer
            </button>
          </form>
        </div>
      </div>

      {/* Members assignment */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50">
          <h3 className="font-semibold text-gray-900">Affectation des agents</h3>
          <p className="text-xs text-gray-400 mt-0.5">{users.length} compte{users.length !== 1 ? 's' : ''} · recherche par nom ou rôle</p>
        </div>
        <OrgUserTable users={users} depts={deptSelectList} />
      </div>
    </div>
  );
}
