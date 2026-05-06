'use client';

import { useRouter } from 'next/navigation';
import { LogOut, Info } from 'lucide-react';
import { useSession } from '@/app/sigep/dashboard/context';
import RoleBadge from '@/components/ui/RoleBadge';
import { createClient, IS_DEMO_MODE } from '@/lib/supabase/client';
import AlertBell from '@/components/realtime/AlertBell';
import ConnectionStatus from '@/components/realtime/ConnectionStatus';

export default function Topbar({ title }: { title: string }) {
  const session = useSession();
  const router = useRouter();

  async function handleSignOut() {
    if (!IS_DEMO_MODE) {
      const supabase = createClient();
      await supabase?.auth.signOut();
    }
    router.push('/sigep/login');
  }

  return (
    <header className="h-14 bg-white border-b border-gray-100 flex items-center justify-between px-6">
      <h1 className="text-base font-semibold text-gray-900">{title}</h1>

      <div className="flex items-center gap-3">
        {IS_DEMO_MODE && (
          <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-full px-3 py-1 text-xs text-amber-700 font-medium">
            <Info className="w-3 h-3" />
            Mode démo
          </div>
        )}

        <ConnectionStatus />
        <AlertBell />

        <RoleBadge role={session.role} />

        <div className="text-right">
          <p className="text-sm font-medium text-gray-900 leading-tight">{session.full_name}</p>
          {session.badge_number && (
            <p className="text-xs text-gray-400 leading-tight">{session.badge_number}</p>
          )}
        </div>

        <button
          onClick={handleSignOut}
          className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
          title="Se déconnecter"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
