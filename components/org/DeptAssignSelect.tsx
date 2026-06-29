'use client';

import { assignUserDepartmentAction } from '@/app/sigep/dashboard/organisation/actions';

interface Dept { id: string; name: string }

export default function DeptAssignSelect({ userId, value, depts }: { userId: string; value: string | null; depts: Dept[] }) {
  return (
    <form action={assignUserDepartmentAction}>
      <input type="hidden" name="userId" value={userId} />
      <select
        name="department_id"
        defaultValue={value ?? ''}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="text-xs border border-gray-200 rounded-md px-2 py-1 max-w-[180px]"
      >
        <option value="">— Aucun —</option>
        {depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
      </select>
    </form>
  );
}
