'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, Polygon, Polyline, LayersControl, ZoomControl, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { DrawnShape } from '@/components/geofences/GeofenceDrawMap';
// leaflet/dist/leaflet.css is imported globally in app/layout.tsx

// Use self-hosted icons — avoids CSP issues with external CDNs
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: '/leaflet/marker-icon-2x.png',
  iconUrl:       '/leaflet/marker-icon.png',
  shadowUrl:     '/leaflet/marker-shadow.png',
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
  caseId: string;
  caseRef: string;
  label: string;
  lat: number;
  lng: number;
  status: 'active' | 'alert' | 'offline';
  lastUpdate: string;
  geofenceRadius?: number;
  battery?: number | null;
  speedKmh?: number | null;
  online?: boolean;
}

export interface MapGeofence {
  id: string;
  name: string;
  isExclusion: boolean;
  // GeoJSON polygon ring [[lng,lat],...] OR circle center+radius
  polygon?: [number, number][] | null; // [lat,lng] pairs
  center?: [number, number] | null;
  radiusM?: number | null;
}

interface TrackingMapProps {
  markers: TrackerMarker[];
  geofences?: MapGeofence[];
  center?: [number, number];
  zoom?: number;
}

// Center on the first marker ONCE on mount, then never auto-recenter again —
// so the user's zoom/pan is preserved while markers update live.
function InitialView({ markers }: { markers: TrackerMarker[] }) {
  const map = useMap();
  const done = useRef(false);
  useEffect(() => {
    if (done.current || markers.length === 0) return;
    done.current = true;
    map.setView([markers[0].lat, markers[0].lng], map.getZoom());
  }, [markers, map]);
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

// Leaflet-draw control for tracing a geofence directly on the surveillance map.
function DrawControl({ onShapeDrawn }: { onShapeDrawn: (s: DrawnShape) => void }) {
  const map = useMap();
  const cleanupRef = useRef<() => void>(() => {});

  const setup = useCallback(async () => {
    const Lmod = (await import('leaflet')).default;
    await import('leaflet-draw');
    cleanupRef.current();

    const drawnItems = new Lmod.FeatureGroup();
    map.addLayer(drawnItems);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const DrawCtl = (Lmod.Control as any).Draw;
    const control = new DrawCtl({
      position: 'topleft',
      draw: {
        rectangle: false, polyline: false, marker: false, circlemarker: false,
        polygon: { allowIntersection: false, showArea: true, shapeOptions: { color: '#2563eb', fillColor: '#2563eb', fillOpacity: 0.12, weight: 2 } },
        circle: { shapeOptions: { color: '#2563eb', fillColor: '#2563eb', fillOpacity: 0.12, weight: 2 } },
      },
      edit: { featureGroup: drawnItems, remove: true },
    });
    map.addControl(control);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function onCreated(e: any) {
      drawnItems.clearLayers();
      drawnItems.addLayer(e.layer);
      if (e.layerType === 'circle') {
        const c = e.layer.getLatLng();
        onShapeDrawn({ type: 'circle', center: [c.lat, c.lng], radius_m: Math.round(e.layer.getRadius()) });
      } else if (e.layerType === 'polygon') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const latlngs: any[] = e.layer.getLatLngs()[0];
        const coords = latlngs.map((ll) => [ll.lng, ll.lat]);
        coords.push(coords[0]);
        onShapeDrawn({ type: 'polygon', coordinates: coords });
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    map.on((Lmod as any).Draw.Event.CREATED, onCreated);

    cleanupRef.current = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      map.off((Lmod as any).Draw.Event.CREATED, onCreated);
      map.removeControl(control);
      map.removeLayer(drawnItems);
    };
  }, [map, onShapeDrawn]);

  useEffect(() => { setup(); return () => cleanupRef.current(); }, [setup]);
  return null;
}

// Recenters on the target whenever it moves — only while "follow" is enabled.
function FollowController({ target, follow }: { target: [number, number] | null; follow: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (follow && target) map.setView(target, map.getZoom());
  }, [target, follow, map]);
  return null;
}

export default function TrackingMap({ markers, geofences = [], center = [12.3647, -1.5332], zoom = 13 }: TrackingMapProps) {
  const [follow, setFollow] = useState(false);
  const [showTrail, setShowTrail] = useState(false);
  const [trail, setTrail] = useState<[number, number][]>([]);
  const [drawing, setDrawing] = useState(false);
  const [drawnShape, setDrawnShape] = useState<DrawnShape | null>(null);
  const [gfName, setGfName] = useState('');
  const [gfExclusion, setGfExclusion] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const primary = markers[0];
  const target: [number, number] | null = primary ? [primary.lat, primary.lng] : null;

  const centerOnDevice = () => {
    if (mapRef.current && target) {
      mapRef.current.setView(target, Math.max(mapRef.current.getZoom(), 16));
    }
  };

  const saveGeofence = async () => {
    if (!drawnShape || !primary?.caseId || !gfName.trim()) { setSaveErr('Nom et tracé requis'); return; }
    setSaving(true); setSaveErr(null);
    const payload = drawnShape.type === 'circle'
      ? { caseId: primary.caseId, name: gfName.trim(), isExclusion: gfExclusion, shape: 'circle', center: drawnShape.center, radiusM: drawnShape.radius_m }
      : { caseId: primary.caseId, name: gfName.trim(), isExclusion: gfExclusion, shape: 'polygon', coordinates: drawnShape.coordinates };
    try {
      const res = await fetch('/api/track/geofence', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const d = await res.json();
      if (!res.ok) { setSaveErr(d.error ?? 'Erreur'); setSaving(false); return; }
      setDrawnShape(null); setGfName(''); setDrawing(false); setSaving(false);
    } catch { setSaveErr('Erreur réseau'); setSaving(false); }
  };

  // Fetch the GPS trail when "Trajet" is enabled (and refresh it as the device moves).
  useEffect(() => {
    if (!showTrail || !primary?.caseId) { setTrail([]); return; }
    let active = true;
    fetch(`/api/track/history?caseId=${encodeURIComponent(primary.caseId)}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => { if (active && Array.isArray(d.trail)) setTrail(d.trail); })
      .catch(() => {});
    return () => { active = false; };
  }, [showTrail, primary?.caseId, primary?.lat, primary?.lng]);

  return (
    <div style={{ position: 'relative', height: '100%', width: '100%' }}>
    <MapContainer
      ref={mapRef}
      center={center}
      zoom={zoom}
      style={{ height: '100%', width: '100%' }}
      scrollWheelZoom
      zoomControl={false}
    >
      <ZoomControl position="bottomleft" />
      <InitialView markers={markers} />
      <FollowController target={target} follow={follow} />
      {drawing && <DrawControl onShapeDrawn={setDrawnShape} />}
      <LayersControl position="topright">
        <LayersControl.BaseLayer checked name="Plan (rues)">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
        </LayersControl.BaseLayer>
        <LayersControl.BaseLayer name="Satellite">
          <TileLayer
            attribution='Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            maxZoom={19}
          />
        </LayersControl.BaseLayer>
        <LayersControl.Overlay name="Noms de lieux (sur satellite)">
          <TileLayer
            attribution='Tiles &copy; Esri'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
            maxZoom={19}
          />
        </LayersControl.Overlay>
      </LayersControl>

      {/* Geofences — blue = inclusion (must stay in), red = exclusion (must stay out) */}
      {geofences.map((g) => {
        const color = g.isExclusion ? '#dc2626' : '#2563eb';
        const opts = { color, fillColor: color, fillOpacity: 0.08, weight: 2, dashArray: g.isExclusion ? '6 4' : undefined };
        if (g.polygon && g.polygon.length > 2) {
          return <Polygon key={g.id} positions={g.polygon} pathOptions={opts}><Popup>{g.name}</Popup></Polygon>;
        }
        if (g.center && g.radiusM) {
          return <Circle key={g.id} center={g.center} radius={g.radiusM} pathOptions={opts}><Popup>{g.name}</Popup></Circle>;
        }
        return null;
      })}

      {/* GPS trail (history) */}
      {showTrail && trail.length > 1 && (
        <Polyline positions={trail} pathOptions={{ color: '#7c3aed', weight: 3, opacity: 0.8 }} />
      )}

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
                {m.battery != null && <div style={{ color: '#475569' }}>Batterie : {m.battery}%</div>}
                {m.speedKmh != null && <div style={{ color: '#475569' }}>Vitesse : {m.speedKmh.toFixed(1)} km/h</div>}
                <div style={{ color: '#94a3b8', fontSize: 10 }}>Mise à jour : {m.lastUpdate}</div>
              </div>
            </Popup>
          </Marker>
        </div>
      ))}
    </MapContainer>

    {/* Device details panel */}
    {primary && (
      <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 1000, background: '#fff', borderRadius: 12, boxShadow: '0 4px 16px rgba(0,0,0,.15)', padding: '12px 14px', minWidth: 190, fontSize: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2 }}>{primary.label}</div>
        <div style={{ color: '#64748b', fontSize: 11, marginBottom: 8 }}>{primary.caseRef}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: primary.online ? '#059669' : '#94a3b8' }} />
          <span style={{ fontWeight: 600, color: primary.online ? '#059669' : '#94a3b8' }}>{primary.online ? 'En ligne' : 'Hors ligne'}</span>
        </div>
        {primary.battery != null && <div style={{ marginBottom: 3 }}>🔋 Batterie : <b>{primary.battery}%</b></div>}
        {primary.speedKmh != null && <div style={{ marginBottom: 3 }}>🚶 Vitesse : <b>{primary.speedKmh.toFixed(1)} km/h</b></div>}
        <div style={{ color: '#94a3b8', fontSize: 10, marginTop: 4 }}>MAJ : {primary.lastUpdate}</div>
      </div>
    )}

    {/* Center / follow controls */}
    {primary && (
      <div style={{ position: 'absolute', bottom: 16, right: 12, zIndex: 1000, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button
          onClick={centerOnDevice}
          data-tip="Recentrer la carte sur la position actuelle du bracelet"
          style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '8px 12px', fontSize: 12, fontWeight: 600, color: '#0f172a', boxShadow: '0 2px 8px rgba(0,0,0,.12)', cursor: 'pointer' }}
        >
          📍 Centrer
        </button>
        <button
          onClick={() => setFollow((f) => !f)}
          data-tip="Suivi automatique : la carte recentre en continu sur le bracelet à chaque déplacement"
          style={{ background: follow ? '#059669' : '#fff', border: '1px solid ' + (follow ? '#059669' : '#e2e8f0'), borderRadius: 10, padding: '8px 12px', fontSize: 12, fontWeight: 600, color: follow ? '#fff' : '#0f172a', boxShadow: '0 2px 8px rgba(0,0,0,.12)', cursor: 'pointer' }}
        >
          {follow ? '🎯 Suivi ON' : '🎯 Suivre'}
        </button>
        <button
          onClick={() => setShowTrail((t) => !t)}
          data-tip="Afficher / masquer le tracé du parcours récent sur la carte"
          style={{ background: showTrail ? '#7c3aed' : '#fff', border: '1px solid ' + (showTrail ? '#7c3aed' : '#e2e8f0'), borderRadius: 10, padding: '8px 12px', fontSize: 12, fontWeight: 600, color: showTrail ? '#fff' : '#0f172a', boxShadow: '0 2px 8px rgba(0,0,0,.12)', cursor: 'pointer' }}
        >
          {showTrail ? '🛣️ Trajet ON' : '🛣️ Trajet'}
        </button>
        <button
          onClick={() => { setDrawing((d) => !d); setDrawnShape(null); setSaveErr(null); }}
          data-tip="Tracer une zone (géofence) directement sur la carte : cercle ou polygone, autorisée ou interdite"
          style={{ background: drawing ? '#2563eb' : '#fff', border: '1px solid ' + (drawing ? '#2563eb' : '#e2e8f0'), borderRadius: 10, padding: '8px 12px', fontSize: 12, fontWeight: 600, color: drawing ? '#fff' : '#0f172a', boxShadow: '0 2px 8px rgba(0,0,0,.12)', cursor: 'pointer' }}
        >
          {drawing ? '✏️ Dessin ON' : '✏️ Tracer zone'}
        </button>
      </div>
    )}

    {/* Drawing hint + save form */}
    {drawing && (
      <div style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 1000, background: '#fff', borderRadius: 12, boxShadow: '0 4px 16px rgba(0,0,0,.18)', padding: '12px 14px', width: 300, fontSize: 12 }}>
        {!drawnShape ? (
          <div style={{ color: '#475569' }}>
            Utilise l&apos;outil polygone ou cercle (haut-gauche) pour tracer la zone autour de {primary?.label ?? 'la cible'}.
          </div>
        ) : (
          <div>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Enregistrer la zone</div>
            <input
              value={gfName}
              onChange={(e) => setGfName(e.target.value)}
              placeholder="Nom de la zone"
              style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: 8, padding: '6px 8px', fontSize: 12, marginBottom: 8 }}
            />
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, cursor: 'pointer' }}>
              <input type="checkbox" checked={gfExclusion} onChange={(e) => setGfExclusion(e.target.checked)} />
              <span>{gfExclusion ? 'Zone interdite (sortie autorisée → alerte si entre)' : 'Zone autorisée (doit rester dedans)'}</span>
            </label>
            {saveErr && <div style={{ color: '#dc2626', marginBottom: 8 }}>{saveErr}</div>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={saveGeofence} disabled={saving} style={{ flex: 1, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 0', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
              <button onClick={() => { setDrawnShape(null); setGfName(''); setSaveErr(null); }} style={{ background: '#f1f5f9', color: '#0f172a', border: 'none', borderRadius: 8, padding: '7px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                Annuler
              </button>
            </div>
          </div>
        )}
      </div>
    )}
    </div>
  );
}
