'use client';

import { useEffect, useRef, useCallback } from 'react';
import {
  MapContainer, TileLayer, Polygon, Circle, Tooltip, useMap,
} from 'react-leaflet';
import type { Geofence } from '@/lib/supabase/types';

/* ── Types ──────────────────────────────────────────────────────────────────── */

export type DrawnShape =
  | { type: 'circle';  center: [number, number]; radius_m: number }
  | { type: 'polygon'; coordinates: number[][] };  // [[lng,lat], ...]

interface DrawControlProps {
  drawMode: 'circle' | 'polygon';
  onShapeDrawn: (shape: DrawnShape) => void;
}

/* ── Inner control (uses useMap hook so must be inside MapContainer) ──────── */

function DrawControl({ drawMode, onShapeDrawn }: DrawControlProps) {
  const map = useMap();
  const cleanupRef = useRef<() => void>(() => {});

  const setup = useCallback(async () => {
    // Dynamically import Leaflet + leaflet-draw (client-only)
    const L = (await import('leaflet')).default;
    await import('leaflet-draw');

    // Reset previous listeners/controls
    cleanupRef.current();

    const drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);

    const drawOptions: Record<string, unknown> = {
      rectangle:    false,
      polyline:     false,
      marker:       false,
      circlemarker: false,
    };

    if (drawMode === 'circle') {
      drawOptions.circle  = { shapeOptions: { color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.15, weight: 2 } };
      drawOptions.polygon = false;
    } else {
      drawOptions.polygon = {
        allowIntersection: false,
        shapeOptions: { color: '#10b981', fillColor: '#10b981', fillOpacity: 0.15, weight: 2 },
        showArea: true,
      };
      drawOptions.circle = false;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const DrawControl = (L.Control as any).Draw;
    const drawControl = new DrawControl({
      draw: drawOptions,
      edit: { featureGroup: drawnItems, remove: true },
    });
    map.addControl(drawControl);

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
        coords.push(coords[0]); // close ring
        onShapeDrawn({ type: 'polygon', coordinates: coords });
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    map.on((L as any).Draw.Event.CREATED, onCreated);

    cleanupRef.current = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      map.off((L as any).Draw.Event.CREATED, onCreated);
      map.removeControl(drawControl);
      map.removeLayer(drawnItems);
    };
  }, [map, drawMode, onShapeDrawn]);

  useEffect(() => {
    setup();
    return () => cleanupRef.current();
  }, [setup]);

  return null;
}

/* ── Existing geofence display layer ─────────────────────────────────────── */

function ExistingGeofences({ geofences }: { geofences: Geofence[] }) {
  return (
    <>
      {geofences.map((g) => {
        const color = g.is_exclusion ? '#ef4444' : (g.geofence_type === 'BLE_DOMICILE' ? '#3b82f6' : '#10b981');
        if (g.shape_type === 'CIRCLE' && g.center_lat && g.center_lon && g.radius_m) {
          return (
            <Circle
              key={g.id}
              center={[g.center_lat, g.center_lon]}
              radius={g.radius_m}
              pathOptions={{ color, fillColor: color, fillOpacity: 0.1, weight: 1.5, dashArray: '4 4' }}
            >
              <Tooltip sticky>{g.name}</Tooltip>
            </Circle>
          );
        }
        if (g.shape_type === 'POLYGON' && g.area) {
          const positions = g.area.coordinates[0].map(([lng, lat]) => [lat, lng] as [number, number]);
          return (
            <Polygon
              key={g.id}
              positions={positions}
              pathOptions={{ color, fillColor: color, fillOpacity: 0.1, weight: 1.5, dashArray: '4 4' }}
            >
              <Tooltip sticky>{g.name}</Tooltip>
            </Polygon>
          );
        }
        return null;
      })}
    </>
  );
}

/* ── Public component ────────────────────────────────────────────────────── */

interface GeofenceDrawMapProps {
  drawMode: 'circle' | 'polygon';
  onShapeDrawn: (shape: DrawnShape) => void;
  existingGeofences?: Geofence[];
  center?: [number, number];
  zoom?: number;
}

export default function GeofenceDrawMap({
  drawMode,
  onShapeDrawn,
  existingGeofences = [],
  center = [12.3647, -1.5332],
  zoom = 14,
}: GeofenceDrawMapProps) {
  return (
    <MapContainer
      center={center}
      zoom={zoom}
      style={{ height: '100%', width: '100%' }}
      className="rounded-xl"
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />
      <ExistingGeofences geofences={existingGeofences} />
      <DrawControl drawMode={drawMode} onShapeDrawn={onShapeDrawn} />
    </MapContainer>
  );
}
