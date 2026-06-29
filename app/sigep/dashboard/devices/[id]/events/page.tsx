import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getSession } from '@/lib/auth/session';
import { allow, canViewDevices } from '@/lib/auth/permissions';

export const dynamic = 'force-dynamic';

const TYPE_META: Record<string, { label: string; cls: string }> = {
  ONLINE:      { label: 'Reprise contact', cls: 'bg-emerald-100 text-emerald-700' },
  OFFLINE:     { label: 'Perte contact',   cls: 'bg-gray-100 text-gray-600' },
  COMMAND:     { label: 'Commande',        cls: 'bg-blue-100 text-blue-700' },
  RESTART:     { label: 'Redémarrage',     cls: 'bg-amber-100 text-amber-700' },
  TAMPER:      { label: 'Sabotage',        cls: 'bg-red-100 text-red-700' },
  LOW_BATTERY: { label: 'Batterie faible', cls: 'bg-yellow-100 text-yellow-700' },
  SIM_CHANGE:  { label: 'SIM modifiée',    cls: 'bg-violet-100 text-violet-700' },
  ASSIGN:      { label: 'Assignation',     cls: 'bg-blue-100 text-blue-700' },
};

interface EventRow { id: string; event_type: string; detail: string | null; created_at: string; actor?: { full_name?: string } | null }

export default async function DeviceEventsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect('/sigep/login');
  if (!allow(session, canViewDevices(session.role), 'hardware')) redirect('/sigep/dashboard');

  let imei = id.slice(0, 8);
  let events: EventRow[] = [];
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    const { createAdminClient } = await import('@/lib/supabase/admin');
    const sb = createAdminClient();
    if (!sb) notFound();
    const [{ data: dev }, { data: evs }] = await Promise.all([
      sb.from('devices').select('imei').eq('id', id).single(),
      sb.from('device_events').select('id, event_type, detail, created_at, actor:users(full_name)').eq('device_id', id).order('created_at', { ascending: false }).limit(500),
    ]);
    if (!dev) notFound();
    imei = dev.imei as string;
    events = (evs ?? []) as EventRow[];
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div>
        <Link href="/sigep/dashboard/devices" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-1">
          <ArrowLeft className="w-4 h-4" /> Bracelets
        </Link>
        <h1 className="text-xl font-bold text-gray-900">Journal du bracelet</h1>
        <p className="text-sm text-gray-500 font-mono">IMEI {imei}</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {events.length === 0 ? (
          <p className="p-6 text-sm text-gray-400 text-center">Aucun événement enregistré.</p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {events.map((e) => {
              const meta = TYPE_META[e.event_type] ?? { label: e.event_type, cls: 'bg-gray-100 text-gray-600' };
              return (
                <li key={e.id} className="px-5 py-3 flex items-center gap-3">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${meta.cls}`}>{meta.label}</span>
                  <span className="flex-1 text-sm text-gray-700">{e.detail ?? '—'}</span>
                  {e.actor?.full_name && <span className="text-xs text-gray-400">{e.actor.full_name}</span>}
                  <span className="text-xs text-gray-400 whitespace-nowrap">{new Date(e.created_at).toLocaleString('fr-FR', { timeZone: 'UTC' })}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
