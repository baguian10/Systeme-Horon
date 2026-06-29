'use client';

import { useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Circle, Polygon, CircleMarker, Popup, LayersControl, ZoomControl, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useEffect } from 'react';

// Self-hosted icons (CSP-safe) — same convention as TrackingMap.
delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: '/leaflet/marker-icon-2x.png',
  iconUrl: '/leaflet/marker-icon.png',
  shadowUrl: '/leaflet/marker-shadow.png',
});

const movingIcon = new L.DivIcon({
  className: '',
  html: `<div style="width:16px;height:16px;border-radius:50%;background:#7c3aed;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.4)"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

export interface ReplayPoint { lat: number; lng: number; t: number; speed: number | null }
export interface ReplayStop { lat: number; lng: number; start: number; end: number; durationMin: number; address?: string | null }
export interface ReplayGeofence {
  id: string; name: string; isExclusion: boolean;
  polygon?: [number, number][] | null;
  center?: [number, number] | null;
  radiusM?: number | null;
}

interface Props {
  points: ReplayPoint[];
  segments: [number, number][][];
  stops: ReplayStop[];
  geofences: ReplayGeofence[];
  playheadT: number; // epoch ms
  focusStop?: number | null; // index of stop to fly to
}

// Interpolate position along the trail at time t.
function positionAt(points: ReplayPoint[], t: number): [number, number] | null {
  if (points.length === 0) return null;
  if (t <= points[0].t) return [points[0].lat, points[0].lng];
  const last = points[points.length - 1];
  if (t >= last.t) return [last.lat, last.lng];
  // binary search for the surrounding pair
  let lo = 0, hi = points.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (points[mid].t <= t) lo = mid; else hi = mid;
  }
  const a = points[lo], b = points[hi];
  const span = b.t - a.t || 1;
  const f = (t - a.t) / span;
  return [a.lat + (b.lat - a.lat) * f, a.lng + (b.lng - a.lng) * f];
}

// Polyline of the path already travelled up to playheadT.
function traveledPath(points: ReplayPoint[], t: number): [number, number][] {
  const out: [number, number][] = [];
  for (const p of points) {
    if (p.t <= t) out.push([p.lat, p.lng]);
    else break;
  }
  const head = positionAt(points, t);
  if (head && out.length) out.push(head);
  return out;
}

function FitOnce({ points }: { points: ReplayPoint[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    const b = L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number]));
    map.fitBounds(b, { padding: [40, 40] });
  }, [points, map]);
  return null;
}

function FlyToStop({ stops, index }: { stops: ReplayStop[]; index: number | null | undefined }) {
  const map = useMap();
  useEffect(() => {
    if (index == null || !stops[index]) return;
    map.setView([stops[index].lat, stops[index].lng], Math.max(map.getZoom(), 17));
  }, [index, stops, map]);
  return null;
}

export default function HistoryReplayMap({ points, segments, stops, geofences, playheadT, focusStop }: Props) {
  const head = useMemo(() => positionAt(points, playheadT), [points, playheadT]);
  const traveled = useMemo(() => traveledPath(points, playheadT), [points, playheadT]);
  const start = points[0];
  const end = points[points.length - 1];

  return (
    <MapContainer center={[12.3647, -1.5332]} zoom={13} style={{ height: '100%', width: '100%' }} scrollWheelZoom zoomControl={false}>
      <ZoomControl position="bottomleft" />
      <FitOnce points={points} />
      <FlyToStop stops={stops} index={focusStop} />
      <LayersControl position="topright">
        <LayersControl.BaseLayer checked name="Plan (rues)">
          <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        </LayersControl.BaseLayer>
        <LayersControl.BaseLayer name="Satellite">
          <TileLayer attribution='Tiles &copy; Esri' url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" maxZoom={19} />
        </LayersControl.BaseLayer>
      </LayersControl>

      {/* Geofences */}
      {geofences.map((g) => {
        const color = g.isExclusion ? '#dc2626' : '#2563eb';
        const opts = { color, fillColor: color, fillOpacity: 0.06, weight: 2, dashArray: g.isExclusion ? '6 4' : undefined };
        if (g.polygon && g.polygon.length > 2) return <Polygon key={g.id} positions={g.polygon} pathOptions={opts}><Popup>{g.name}</Popup></Polygon>;
        if (g.center && g.radiusM) return <Circle key={g.id} center={g.center} radius={g.radiusM} pathOptions={opts}><Popup>{g.name}</Popup></Circle>;
        return null;
      })}

      {/* Full faint path (each continuous segment) */}
      {segments.map((seg, i) =>
        seg.length > 1 ? <Polyline key={`seg-${i}`} positions={seg} pathOptions={{ color: '#94a3b8', weight: 2, opacity: 0.5 }} /> : null
      )}

      {/* Travelled path so far (bright) */}
      {traveled.length > 1 && (
        <Polyline positions={traveled} pathOptions={{ color: '#7c3aed', weight: 4, opacity: 0.9 }} />
      )}

      {/* Stops */}
      {stops.map((s, i) => (
        <CircleMarker key={`stop-${i}`} center={[s.lat, s.lng]} radius={9} pathOptions={{ color: '#fff', weight: 2, fillColor: '#f59e0b', fillOpacity: 1 }}>
          <Popup>
            <div style={{ fontSize: 12, minWidth: 160 }}>
              <b>Arrêt #{i + 1}</b> — {s.durationMin} min<br />
              {fmt(s.start)} → {fmt(s.end)}<br />
              {s.address ?? `${s.lat.toFixed(5)}, ${s.lng.toFixed(5)}`}
            </div>
          </Popup>
        </CircleMarker>
      ))}

      {/* Start / end flags */}
      {start && <CircleMarker center={[start.lat, start.lng]} radius={7} pathOptions={{ color: '#fff', weight: 2, fillColor: '#059669', fillOpacity: 1 }}><Popup>Départ {fmt(start.t)}</Popup></CircleMarker>}
      {end && <CircleMarker center={[end.lat, end.lng]} radius={7} pathOptions={{ color: '#fff', weight: 2, fillColor: '#dc2626', fillOpacity: 1 }}><Popup>Dernier point {fmt(end.t)}</Popup></CircleMarker>}

      {/* Moving playhead marker */}
      {head && <Marker position={head} icon={movingIcon} />}
    </MapContainer>
  );
}

function fmt(ms: number): string {
  return new Date(ms).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
}
