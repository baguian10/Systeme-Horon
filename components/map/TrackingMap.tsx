'use client';

import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const activeIcon = new L.DivIcon({
  className: '',
  html: `<div style="width:14px;height:14px;border-radius:50%;background:#059669;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35)"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
  popupAnchor: [0, -10],
});

const alertIcon = new L.DivIcon({
  className: '',
  html: `<div style="width:14px;height:14px;border-radius:50%;background:#dc2626;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35)"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
  popupAnchor: [0, -10],
});

const offlineIcon = new L.DivIcon({
  className: '',
  html: `<div style="width:14px;height:14px;border-radius:50%;background:#94a3b8;border:3px solid #fff;box-shadow:0 2px 4px rgba(0,0,0,.2)"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
  popupAnchor: [0, -10],
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
  active:  '#059669',
  alert:   '#dc2626',
  offline: '#94a3b8',
};

const STATUS_LABELS: Record<TrackerMarker['status'], string> = {
  active:  'Actif',
  alert:   'Violation',
  offline: 'Hors ligne',
};

function getIcon(status: TrackerMarker['status']) {
  if (status === 'alert') return alertIcon;
  if (status === 'offline') return offlineIcon;
  return activeIcon;
}

export default function TrackingMap({ markers, center = [12.3647, -1.5332], zoom = 13 }: TrackingMapProps) {
  return (
    <MapContainer
      center={center}
      zoom={zoom}
      style={{ height: '100%', width: '100%', minHeight: 480 }}
      scrollWheelZoom
    >
      <RecenterMap center={center} />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
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
          <Marker position={[m.lat, m.lng]} icon={getIcon(m.status)}>
            <Popup>
              <div style={{ minWidth: 160, fontSize: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{m.caseRef}</div>
                <div style={{ color: '#475569', marginBottom: 6 }}>{m.label}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: STATUS_COLORS[m.status] }} />
                  <span style={{ fontWeight: 600, color: STATUS_COLORS[m.status] }}>{STATUS_LABELS[m.status]}</span>
                </div>
                <div style={{ color: '#94a3b8', fontSize: 10 }}>Mise à jour : {m.lastUpdate}</div>
              </div>
            </Popup>
          </Marker>
        </div>
      ))}
    </MapContainer>
  );
}
