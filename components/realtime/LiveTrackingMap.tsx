'use client';

import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { LivePosition } from '@/hooks/usePositionFeed';
import type { CaseStatus } from '@/lib/supabase/types';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: '/leaflet/marker-icon-2x.png',
  iconUrl:       '/leaflet/marker-icon.png',
  shadowUrl:     '/leaflet/marker-shadow.png',
});

const DOT_COLORS: Record<CaseStatus, string> = {
  ACTIVE:     '#4ade80',
  VIOLATION:  '#ef4444',
  PENDING:    '#facc15',
  SUSPENDED:  '#9ca3af',
  TERMINATED: '#cbd5e1',
};

const STATUS_LABELS: Record<CaseStatus, string> = {
  ACTIVE:     'Actif',
  VIOLATION:  'Violation',
  PENDING:    'En attente',
  SUSPENDED:  'Suspendu',
  TERMINATED: 'Terminé',
};

function makeIcon(status: CaseStatus, alertCount: number) {
  const color = DOT_COLORS[status] ?? DOT_COLORS.ACTIVE;
  const isViolation = status === 'VIOLATION';
  const ringHtml = isViolation
    ? `<div style="position:absolute;inset:-6px;border-radius:50%;border:2px solid ${color};opacity:0.5;animation:liveRing 1.4s ease-out infinite"></div>`
    : '';
  const badgeHtml = alertCount > 0
    ? `<div style="position:absolute;top:-8px;right:-8px;width:15px;height:15px;border-radius:50%;background:#ef4444;color:#fff;font-size:8px;font-weight:700;display:flex;align-items:center;justify-content:center;border:1.5px solid #fff;z-index:1">${Math.min(alertCount, 9)}</div>`
    : '';

  return new L.DivIcon({
    className: '',
    html: `<div style="position:relative;width:14px;height:14px">
      ${ringHtml}
      <div style="width:14px;height:14px;border-radius:50%;background:${color};border:2.5px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.45)"></div>
      ${badgeHtml}
    </div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    popupAnchor: [0, -14],
  });
}

function FitBounds({ positions }: { positions: LivePosition[] }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length === 0) return;
    const bounds = L.latLngBounds(positions.map((p) => [p.latitude, p.longitude]));
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positions.length]);
  return null;
}

interface Props {
  positions: LivePosition[];
}

export default function LiveTrackingMap({ positions }: Props) {
  return (
    <>
      <style>{`
        @keyframes liveRing {
          0%   { transform: scale(1);   opacity: 0.6; }
          100% { transform: scale(2.2); opacity: 0; }
        }
      `}</style>
      <MapContainer
        center={[12.3647, -1.5332]}
        zoom={13}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds positions={positions} />
        {positions.map((pos) => (
          <Marker
            key={pos.case_id}
            position={[pos.latitude, pos.longitude]}
            icon={makeIcon(pos.status, pos.alert_count)}
          >
            <Popup>
              <div style={{ minWidth: 160, fontSize: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4, fontFamily: 'monospace' }}>
                  {pos.case_number}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: DOT_COLORS[pos.status] }} />
                  <span style={{ fontWeight: 600, color: DOT_COLORS[pos.status] }}>{STATUS_LABELS[pos.status]}</span>
                </div>
                {pos.speed_kmh !== null && (
                  <div style={{ color: '#64748b', marginBottom: 3 }}>{pos.speed_kmh.toFixed(1)} km/h</div>
                )}
                {pos.alert_count > 0 && (
                  <div style={{ color: '#ef4444', fontWeight: 700, marginBottom: 3 }}>
                    {pos.alert_count} alerte{pos.alert_count > 1 ? 's' : ''} active{pos.alert_count > 1 ? 's' : ''}
                  </div>
                )}
                <div style={{ color: '#94a3b8', fontSize: 10 }}>
                  {pos.latitude.toFixed(5)}, {pos.longitude.toFixed(5)}
                </div>
                <div style={{ color: '#94a3b8', fontSize: 10, marginTop: 2 }}>
                  {new Date(pos.recorded_at).toLocaleTimeString('fr-FR', {
                    hour: '2-digit', minute: '2-digit', second: '2-digit',
                  })}
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </>
  );
}
