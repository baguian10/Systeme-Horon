import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getSession } from '@/lib/auth/session';
import EscortSharing from '@/components/realtime/EscortSharing';

export const metadata = { title: 'Escorte — SIGEP' };
export const dynamic = 'force-dynamic';

// Page destinée au téléphone de l'agent qui part sur le terrain : il partage sa
// position, le centre voit les deux points converger. Volontairement dépouillée
// — elle s'utilise debout, dehors, à une main.
export default async function EscortePage() {
  const session = await getSession();
  if (!session) redirect('/sigep/login');

  return (
    <div className="max-w-md mx-auto space-y-4">
      <Link href="/sigep/dashboard/terrain" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="w-4 h-4" /> Terrain
      </Link>
      <div>
        <h2 className="text-xl font-bold text-gray-900">Escorte</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Partagez votre position pendant l&apos;intervention. Le centre vous voit sur la carte, avec la
          distance qui vous sépare de la personne suivie.
        </p>
      </div>
      <EscortSharing agentName={session.full_name} />
      <p className="text-[11px] text-gray-400">
        Le partage s&apos;arrête dès que vous quittez la page ou appuyez sur Arrêter, et rien n&apos;est
        conservé : seule votre position du moment existe, remplacée à chaque relevé.
      </p>
    </div>
  );
}
