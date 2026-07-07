'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, Polygon, LayersControl, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { LivePosition } from '@/hooks/usePositionFeed';
import type { CaseStatus } from '@/lib/supabase/types';

delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
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
  ARCHIVED:   '#d1d5db',
};

const STATUS_LABELS: Record<CaseStatus, string> = {
  ACTIVE: 'Actif', VIOLATION: 'Violation', PENDING: 'En attente',
  SUSPENDED: 'Suspendu', TERMINATED: 'Terminé', ARCHIVED: 'Archivé',
};

const STALE_MS = 5 * 60_000;   // grey out after 5 min without a fix
const TRAIL_MS = 30 * 60_000;  // keep 30 min of trail
const ANIM_MS  = 1_200;        // marker glide duration between fixes

export interface MapGeofenceLite {
  id: string;
  case_id: string;
  name: string;
  is_exclusion: boolean;
  shape_type: 'CIRCLE' | 'POLYGON';
  center_lat: number | null;
  center_lon: number | null;
  radius_m: number | null;
  area: { coordinates: number[][][] } | null;
}

// Bearing (degrees) from A to B — drives the heading arrow.
function bearingDeg(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const y = Math.sin(r(bLng - aLng)) * Math.cos(r(bLat));
  const x = Math.cos(r(aLat)) * Math.sin(r(bLat)) - Math.sin(r(aLat)) * Math.cos(r(bLat)) * Math.cos(r(bLng - aLng));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function makeIcon(status: CaseStatus, alertCount: number, opts: { stale: boolean; bearing: number | null; speed: number | null; following: boolean }) {
  const color = opts.stale ? '#94a3b8' : (DOT_COLORS[status] ?? DOT_COLORS.ACTIVE);
  const isViolation = !opts.stale && status === 'VIOLATION';
  const ringHtml = isViolation
    ? `<div style="position:absolute;inset:-6px;border-radius:50%;border:2px solid ${color};opacity:0.5;animation:liveRing 1.4s ease-out infinite"></div>`
    : '';
  const followHtml = opts.following
    ? `<div style="position:absolute;inset:-9px;border-radius:50%;border:2px dashed #3b82f6;animation:liveSpin 3s linear infinite"></div>`
    : '';
  const badgeHtml = alertCount > 0
    ? `<div style="position:absolute;top:-8px;right:-8px;width:15px;height:15px;border-radius:50%;background:#ef4444;color:#fff;font-size:8px;font-weight:700;display:flex;align-items:center;justify-content:center;border:1.5px solid #fff;z-index:2">${Math.min(alertCount, 9)}</div>`
    : '';
  // Heading arrow — only when moving and fresh.
  const arrowHtml = (!opts.stale && opts.bearing != null && (opts.speed ?? 0) >= 3)
    ? `<div style="position:absolute;left:50%;top:50%;width:0;height:0;transform:translate(-50%,-50%) rotate(${Math.round(opts.bearing)}deg) translateY(-13px);border-left:4px solid transparent;border-right:4px solid transparent;border-bottom:7px solid ${color};filter:drop-shadow(0 1px 1px rgba(0,0,0,.4))"></div>`
    : '';
  const speedHtml = (!opts.stale && (opts.speed ?? 0) >= 3)
    ? `<div style="position:absolute;top:16px;left:50%;transform:translateX(-50%);background:rgba(15,23,42,.85);color:#e2e8f0;font-size:8px;font-weight:600;padding:1px 4px;border-radius:4px;white-space:nowrap">${Math.round(opts.speed!)} km/h</div>`
    : '';

  return new L.DivIcon({
    className: '',
    html: `<div style="position:relative;width:14px;height:14px">
      ${followHtml}${ringHtml}${arrowHtml}
      <div style="width:14px;height:14px;border-radius:50%;background:${color};border:2.5px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.45);${opts.stale ? 'opacity:.65' : ''}"></div>
      ${badgeHtml}${speedHtml}
    </div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    popupAnchor: [0, -14],
  });
}

function FitBounds({ positions, disabled }: { positions: LivePosition[]; disabled: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (disabled || positions.length === 0) return;
    const bounds = L.latLngBounds(positions.map((p) => [p.latitude, p.longitude]));
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positions.length, disabled]);
  return null;
}

// Camera lock: pans smoothly to the followed tracker on every new fix.
function FollowCamera({ target }: { target: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (!target) return;
    map.panTo(target, { animate: true, duration: 0.8 });
  }, [map, target]);
  return null;
}

// Marker that GLIDES between fixes instead of jumping: the underlying Leaflet
// marker is mutated frame-by-frame (rAF), outside the React render cycle.
function AnimatedMarker({ pos, icon, children }: { pos: LivePosition; icon: L.DivIcon; children: React.ReactNode }) {
  const ref = useRef<L.Marker | null>(null);
  // Mount-time position only — afterwards the Leaflet marker is mutated
  // directly by the animation loop, outside React.
  const [mountPos] = useState<[number, number]>([pos.latitude, pos.longitude]);
  const shown = useRef<[number, number]>([pos.latitude, pos.longitude]);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    const marker = ref.current;
    if (!marker) return;
    const [fromLat, fromLng] = shown.current;
    const toLat = pos.latitude, toLng = pos.longitude;
    if (fromLat === toLat && fromLng === toLng) return;
    if (raf.current) cancelAnimationFrame(raf.current);
    const t0 = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / ANIM_MS);
      const e = 1 - (1 - k) * (1 - k); // ease-out
      const lat = fromLat + (toLat - fromLat) * e;
      const lng = fromLng + (toLng - fromLng) * e;
      shown.current = [lat, lng];
      marker.setLatLng([lat, lng]);
      if (k < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [pos.latitude, pos.longitude]);

  return (
    <Marker
      ref={ref as never}
      position={mountPos}
      icon={icon}
    >
      {children}
    </Marker>
  );
}

interface Props {
  positions: LivePosition[];
  geofences?: MapGeofenceLite[];
}

type TrailPoint = { lat: number; lng: number; ts: number };

export default function LiveTrackingMap({ positions, geofences = [] }: Props) {
  const [now, setNow] = useState(() => Date.now());
  const [followId, setFollowId] = useState<string | null>(null);
  const [trailMap, setTrailMap] = useState<Map<string, TrailPoint[]>>(new Map());
  const [bearingMap, setBearingMap] = useState<Map<string, number>>(new Map());
  const prevFix = useRef<Map<string, { lat: number; lng: number; at: string }>>(new Map());

  // Staleness clock.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(id);
  }, []);

  // Accumulate trails + headings from the live feed (deduped per fix).
  useEffect(() => {
    let changed = false;
    const nextTrails = new Map(trailMap);
    const nextBearings = new Map(bearingMap);
    for (const p of positions) {
      const prev = prevFix.current.get(p.case_id);
      if (prev && prev.at === p.recorded_at) continue;
      if (prev && (prev.lat !== p.latitude || prev.lng !== p.longitude)) {
        nextBearings.set(p.case_id, bearingDeg(prev.lat, prev.lng, p.latitude, p.longitude));
      }
      prevFix.current.set(p.case_id, { lat: p.latitude, lng: p.longitude, at: p.recorded_at });
      const arr = [...(nextTrails.get(p.case_id) ?? [])];
      arr.push({ lat: p.latitude, lng: p.longitude, ts: Date.parse(p.recorded_at) || Date.now() });
      nextTrails.set(p.case_id, arr);
      changed = true;
    }
    // Prune anything older than the trail window.
    const cutoff = Date.now() - TRAIL_MS;
    for (const [id, arr] of nextTrails) {
      const kept = arr.filter((t) => t.ts >= cutoff);
      if (kept.length !== arr.length) { nextTrails.set(id, kept); changed = true; }
    }
    if (changed) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTrailMap(nextTrails);
      setBearingMap(nextBearings);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positions]);

  const violationCases = useMemo(
    () => new Set(positions.filter((p) => p.status === 'VIOLATION').map((p) => p.case_id)),
    [positions],
  );

  const followTarget = useMemo<[number, number] | null>(() => {
    if (!followId) return null;
    const p = positions.find((x) => x.case_id === followId);
    return p ? [p.latitude, p.longitude] : null;
  }, [followId, positions]);

  // Trail age buckets → fading opacity (recent bold, old faint).
  function trailSegments(arr: TrailPoint[], color: string) {
    const buckets: { pts: [number, number][]; opacity: number }[] = [
      { pts: [], opacity: 0.65 }, { pts: [], opacity: 0.35 }, { pts: [], opacity: 0.15 },
    ];
    for (const t of arr) {
      const age = now - t.ts;
      const b = age < 10 * 60_000 ? 0 : age < 20 * 60_000 ? 1 : 2;
      buckets[b].pts.push([t.lat, t.lng]);
    }
    // Stitch buckets so lines connect across boundaries.
    if (buckets[1].pts.length && buckets[0].pts.length) buckets[1].pts.push(buckets[0].pts[0]);
    if (buckets[2].pts.length && buckets[1].pts.length) buckets[2].pts.push(buckets[1].pts[0]);
    return buckets
      .filter((b) => b.pts.length >= 2)
      .map((b, i) => ({ key: `${i}`, pts: b.pts, color, opacity: b.opacity }));
  }

  return (
    <>
      <style>{`
        @keyframes liveRing { 0% { transform: scale(1); opacity: .6 } 100% { transform: scale(2.2); opacity: 0 } }
        @keyframes liveSpin { to { transform: rotate(360deg) } }
        @keyframes gfPulse  { 0%,100% { stroke-opacity: .9 } 50% { stroke-opacity: .25 } }
        .gf-violation { animation: gfPulse 1.2s ease-in-out infinite; }
      `}</style>
      <MapContainer center={[12.3647, -1.5332]} zoom={13} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
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

        <FitBounds positions={positions} disabled={followId != null} />
        <FollowCamera target={followTarget} />

        {/* Geofences — inclusion emerald, exclusion red dashed; the zones of a
            case currently in VIOLATION pulse. */}
        {geofences.map((g) => {
          const violating = violationCases.has(g.case_id);
          const color = g.is_exclusion ? '#ef4444' : '#10b981';
          const common = {
            color, weight: 2, fillColor: color, fillOpacity: 0.06,
            dashArray: g.is_exclusion ? '6 4' : undefined,
            className: violating ? 'gf-violation' : undefined,
          };
          if (g.shape_type === 'CIRCLE' && g.center_lat != null && g.center_lon != null && g.radius_m != null) {
            return <Circle key={g.id} center={[g.center_lat, g.center_lon]} radius={g.radius_m} pathOptions={common} />;
          }
          const ring = g.area?.coordinates?.[0];
          if (ring && ring.length >= 3) {
            return <Polygon key={g.id} positions={ring.map(([lng, lat]) => [lat, lng] as [number, number])} pathOptions={common} />;
          }
          return null;
        })}

        {/* Trails — 30 min, fading with age. */}
        {positions.map((p) => {
          const arr = trailMap.get(p.case_id);
          if (!arr || arr.length < 2) return null;
          const color = DOT_COLORS[p.status] ?? '#64748b';
          return trailSegments(arr, color).map((s) => (
            <Polyline key={`${p.case_id}-${s.key}`} positions={s.pts} pathOptions={{ color: s.color, weight: 3, opacity: s.opacity }} />
          ));
        })}

        {/* Trackers — gliding markers with heading, speed, staleness, follow ring. */}
        {positions.map((pos) => {
          const ageMs = now - Date.parse(pos.recorded_at);
          const stale = ageMs > STALE_MS;
          const icon = makeIcon(pos.status, pos.alert_count, {
            stale,
            bearing: bearingMap.get(pos.case_id) ?? null,
            speed: pos.speed_kmh,
            following: followId === pos.case_id,
          });
          return (
            <AnimatedMarker key={pos.case_id} pos={pos} icon={icon}>
              <Popup>
                <div style={{ minWidth: 170, fontSize: 12 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4, fontFamily: 'monospace' }}>{pos.case_number}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: stale ? '#94a3b8' : DOT_COLORS[pos.status] }} />
                    <span style={{ fontWeight: 600, color: stale ? '#94a3b8' : DOT_COLORS[pos.status] }}>
                      {STATUS_LABELS[pos.status]}{stale ? ` · muet ${Math.floor(ageMs / 60_000)} min` : ''}
                    </span>
                  </div>
                  {pos.speed_kmh !== null && <div style={{ color: '#64748b', marginBottom: 3 }}>{pos.speed_kmh.toFixed(1)} km/h</div>}
                  {pos.alert_count > 0 && (
                    <div style={{ color: '#ef4444', fontWeight: 700, marginBottom: 3 }}>
                      {pos.alert_count} alerte{pos.alert_count > 1 ? 's' : ''} active{pos.alert_count > 1 ? 's' : ''}
                    </div>
                  )}
                  <div style={{ color: '#94a3b8', fontSize: 10 }}>{pos.latitude.toFixed(5)}, {pos.longitude.toFixed(5)}</div>
                  <div style={{ color: '#94a3b8', fontSize: 10, marginTop: 2 }}>
                    {new Date(pos.recorded_at).toLocaleTimeString('fr-FR', { timeZone: 'Africa/Ouagadougou', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </div>
                  <button
                    onClick={() => setFollowId((f) => f === pos.case_id ? null : pos.case_id)}
                    style={{
                      marginTop: 6, width: '100%', padding: '4px 8px', borderRadius: 8, border: 'none', cursor: 'pointer',
                      fontSize: 11, fontWeight: 700, color: '#fff',
                      background: followId === pos.case_id ? '#64748b' : '#3b82f6',
                    }}
                  >
                    {followId === pos.case_id ? '✕ Arrêter le suivi' : '⌖ Suivre ce bracelet'}
                  </button>
                </div>
              </Popup>
            </AnimatedMarker>
          );
        })}
      </MapContainer>

      {/* Follow-mode banner */}
      {followId && (
        <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 1000 }}>
          <button
            onClick={() => setFollowId(null)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, background: '#1d4ed8', color: '#fff',
              border: 'none', borderRadius: 10, padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(29,78,216,.4)',
            }}
          >
            ⌖ Suivi : {positions.find((p) => p.case_id === followId)?.case_number ?? '—'} · ✕
          </button>
        </div>
      )}
    </>
  );
}
