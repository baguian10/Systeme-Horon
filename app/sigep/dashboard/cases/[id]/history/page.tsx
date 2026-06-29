import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { fetchCaseById } from '@/lib/mock/helpers';
import { getSession } from '@/lib/auth/session';
import { canViewPII } from '@/lib/auth/permissions';
import HistoryReplay from '@/components/track/HistoryReplay';

export const dynamic = 'force-dynamic';

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function CaseHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [session, caseData] = await Promise.all([getSession(), fetchCaseById(id)]);
  if (!session || !caseData) notFound();

  const showPII = canViewPII(session.role);
  const name = showPII ? caseData.individual?.full_name ?? '—' : 'Personne surveillée';

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link href={`/sigep/dashboard/cases/${id}`} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-1">
            <ArrowLeft className="w-4 h-4" /> Retour au dossier
          </Link>
          <h1 className="text-xl font-bold text-gray-900">Itinéraire — {name}</h1>
          <p className="text-sm text-gray-500">Dossier {caseData.case_number}</p>
        </div>
      </div>

      <HistoryReplay caseId={id} initialDate={todayUTC()} />
    </div>
  );
}
