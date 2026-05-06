'use client';

import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix default marker icons (webpack asset handling strips them)
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const activeIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  className: 'hue-rotate-[100deg]',
});

const alertIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  className: 'hue-rotate-[300deg] saturate-200',
});

export interface TrackerMarker {
  id: string;
  caseRef: string;
  label: string;
  lat: number;
  lng: number;
  status: 'active' | 'alert' | 'offline';
  lastUpdate: string;
  geofenceRadius?: number;
}

interface TrackingMapProps {
  markers: TrackerMarker[];
  center?: [number, number];
  zoom?: number;
}

function RecenterMap({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => { map.setView(center, map.getZoom()); }, [center, map]);
  return null;
}

const STATUS_COLORS: Record<TrackerMarker['status'], string> = {
  active:  '#009E49',
  alert:   '#EF2B2D',
  offline: '#6B7280',
};

const STATUS_LABELS: Record<TrackerMarker['status'], string> = {
  active:  'Actif',
  alert:   'Alerte',
  offline: 'Hors ligne',
};

export default function TrackingMap({ markers, center = [12.3647, -1.5332], zoom = 13 }: TrackingMapProps) {
  return (
    <MapContainer
      center={center}
      zoom={zoom}
      style={{ height: '100%', width: '100%' }}
      className="rounded-2xl z-0"
    >
      <RecenterMap center={center} />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {markers.map((m) => (
        <div key={m.id}>
          {m.geofenceRadius && (
            <Circle
              center={[m.lat, m.lng]}
              radius={m.geofenceRadius}
              pathOptions={{
                color:       STATUS_COLORS[m.status],
                fillColor:   STATUS_COLORS[m.status],
                fillOpacity: 0.07,
                weight:      1.5,
                dashArray:   m.status === 'alert' ? '6 4' : undefined,
              }}
            />
          )}
          <Marker
            position={[m.lat, m.lng]}
            icon={m.status === 'alert' ? alertIcon : activeIcon}
          >
            <Popup>
              <div className="text-xs space-y-1 min-w-[160px]">
                <div className="font-bold text-sm text-gray-900">{m.caseRef}</div>
                <div className="text-gray-600">{m.label}</div>
                <div className="flex items-center gap-1.5 mt-2">
                  <span
                    className="inline-block w-2 h-2 rounded-full"
                    style={{ backgroundColor: STATUS_COLORS[m.status] }}
                  />
                  <span className="font-semibold" style={{ color: STATUS_COLORS[m.status] }}>
                    {STATUS_LABELS[m.status]}
                  </span>
                </div>
                <div className="text-gray-400 text-[10px]">Mise à jour : {m.lastUpdate}</div>
              </div>
            </Popup>
          </Marker>
        </div>
      ))}
    </MapContainer>
  );
}
