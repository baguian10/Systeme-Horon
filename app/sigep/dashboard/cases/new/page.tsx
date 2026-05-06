import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getSession } from '@/lib/auth/session';
import { canCreateCase } from '@/lib/auth/permissions';
import { fetchUnassignedDevices } from '@/lib/mock/helpers';
import CaseForm from '@/components/cases/CaseForm';

export const metadata = { title: 'Nouveau dossier — SIGEP' };

export default async function NewCasePage() {
  const session = await getSession();
  if (!session || !canCreateCase(session.role)) redirect('/sigep/dashboard/cases');

  const unassignedDevices = await fetchUnassignedDevices();

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <Link
          href="/sigep/dashboard/cases"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Retour aux dossiers
        </Link>
        <h2 className="text-xl font-bold text-gray-900">Nouveau dossier</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Créer un dossier de contrôle judiciaire et assigner un bracelet ThinkRace TR40
        </p>
      </div>

      <CaseForm unassignedDevices={unassignedDevices} />
    </div>
  );
}
