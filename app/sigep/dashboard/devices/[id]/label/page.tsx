import { notFound, redirect } from 'next/navigation';
import QRCode from 'qrcode';
import { getSession } from '@/lib/auth/session';
import { allow, canConfigureHardware } from '@/lib/auth/permissions';
import PrintButton from '@/components/devices/PrintButton';

export const dynamic = 'force-dynamic';

interface DeviceLabel {
  imei: string;
  model: string;
  sim_number: string | null;
  sim_carrier: string | null;
  case_number: string | null;
}

async function loadDevice(id: string): Promise<DeviceLabel | null> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return { imei: '860000000000001', model: 'Bracelet TR40', sim_number: '70000000', sim_carrier: 'ORANGE', case_number: 'OUAG-2024-0041' };
  }
  const { createAdminClient } = await import('@/lib/supabase/admin');
  const sb = createAdminClient();
  if (!sb) return null;
  const { data } = await sb
    .from('devices')
    .select('imei, model, sim_number, sim_carrier, case:cases(case_number)')
    .eq('id', id)
    .single();
  if (!data) return null;
  const c = (data as { case?: { case_number?: string } | null }).case;
  return {
    imei: data.imei as string,
    model: data.model as string,
    sim_number: (data.sim_number as string | null) ?? null,
    sim_carrier: (data.sim_carrier as string | null) ?? null,
    case_number: c?.case_number ?? null,
  };
}

export default async function DeviceLabelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect('/sigep/login');
  if (!allow(session, canConfigureHardware(session.role), 'hardware')) redirect('/sigep/dashboard');

  const device = await loadDevice(id);
  if (!device) notFound();

  // QR encodes the IMEI (scannable at the magasin for quick assignment).
  const qrSvg = await QRCode.toString(`IMEI:${device.imei}`, { type: 'svg', margin: 1, width: 150 });

  return (
    <div className="p-6">
      <style>{`@media print { .no-print { display: none !important; } @page { size: 70mm 40mm; margin: 3mm; } body { background: #fff; } }`}</style>

      <div className="no-print mb-4 flex items-center gap-3">
        <PrintButton />
        <span className="text-sm text-gray-500">Format conseillé : étiquette 70×40 mm.</span>
      </div>

      {/* The label itself */}
      <div className="label-card inline-block border border-gray-300 rounded-lg p-3" style={{ width: 280 }}>
        <div className="flex gap-3 items-center">
          <div dangerouslySetInnerHTML={{ __html: qrSvg }} style={{ width: 96, height: 96 }} />
          <div className="text-[11px] leading-tight">
            <div className="font-bold text-sm">SIGEP · HORON</div>
            <div className="text-gray-700">{device.model}</div>
            <div className="font-mono mt-1">IMEI<br /><span className="font-bold">{device.imei}</span></div>
            {device.sim_number && <div className="mt-1">SIM : <span className="font-mono">{device.sim_number}</span>{device.sim_carrier ? ` (${device.sim_carrier})` : ''}</div>}
            {device.case_number && <div className="mt-1">Dossier : <span className="font-mono">{device.case_number}</span></div>}
          </div>
        </div>
      </div>
    </div>
  );
}
