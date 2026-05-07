'use client';

import { useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import type { ViolationHeatPoint, AlertType } from '@/lib/supabase/types';

const TYPE_LABELS: Record<AlertType, string> = {
  GEOFENCE_EXIT:   'Sortie de zone',
  TAMPER_DETECTED: 'Anti-sabotage',
  HEALTH_CRITICAL: 'Santé critique',
  BATTERY_LOW:     'Batterie faible',
  SIGNAL_LOST:     'Signal perdu',
  PANIC_BUTTON:    'Bouton panique',
};

function intensityToColor(intensity: number): string {
  if (intensity >= 5) return '#ef4444'; // red-500
  if (intensity >= 4) return '#f97316'; // orange-500
  if (intensity >= 3) return '#eab308'; // yellow-500
  if (intensity >= 2) return '#84cc16'; // lime-500
  return '#22c55e'; // green-500
}

function FitBounds({ points }: { points: ViolationHeatPoint[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    const L = require('leaflet');
    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng]));
    map.fitBounds(bounds, { padding: [60, 60], maxZoom: 14 });
  }, [points.length]);
  return null;
}

interface Props {
  points: ViolationHeatPoint[];
}

export default function ViolationHeatmapMap({ points }: Props) {
  const center: [number, number] = [12.3647, -1.5332];

  return (
    <>
      <style>{`
        .leaflet-container { background: #0f172a; }
        .heat-tooltip { background: rgba(15,23,42,0.9)!important; border: 1px solid rgba(255,255,255,0.1)!important; border-radius: 8px!important; color: #f1f5f9!important; font-size: 11px!important; }
        .heat-tooltip::before { display: none; }
      `}</style>
      <MapContainer
        center={center}
        zoom={12}
        style={{ height: '100%', width: '100%' }}
        zoomControl={true}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; OpenStreetMap'
          opacity={0.3}
        />
        <FitBounds points={points} />

        {points.map((pt, i) => (
          <CircleMarker
            key={i}
            center={[pt.lat, pt.lng]}
            radius={pt.intensity * 8 + 8}
            pathOptions={{
              fillColor: intensityToColor(pt.intensity),
              fillOpacity: 0.35 + pt.intensity * 0.08,
              color: intensityToColor(pt.intensity),
              weight: 1,
              opacity: 0.6,
            }}
          >
            <Tooltip className="heat-tooltip" sticky>
              <strong>{TYPE_LABELS[pt.alert_type]}</strong>
              <br />
              Intensité: {pt.intensity}/5
              <br />
              {pt.lat.toFixed(4)}, {pt.lng.toFixed(4)}
            </Tooltip>
          </CircleMarker>
        ))}

        {/* Second pass: bright core dots */}
        {points.map((pt, i) => (
          <CircleMarker
            key={`core-${i}`}
            center={[pt.lat, pt.lng]}
            radius={pt.intensity * 2 + 2}
            pathOptions={{
              fillColor: intensityToColor(pt.intensity),
              fillOpacity: 0.9,
              color: '#ffffff',
              weight: 0.5,
              opacity: 0.5,
            }}
          />
        ))}
      </MapContainer>
    </>
  );
}
