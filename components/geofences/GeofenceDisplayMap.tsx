'use client';

import { MapContainer, TileLayer, Polygon, Circle, Tooltip } from 'react-leaflet';
import type { Geofence } from '@/lib/supabase/types';

interface Props {
  geofences: Geofence[];
  center?: [number, number];
  zoom?: number;
  height?: string;
}

export default function GeofenceDisplayMap({
  geofences,
  center = [12.3647, -1.5332],
  zoom = 13,
  height = '100%',
}: Props) {
  return (
    <MapContainer
      center={center}
      zoom={zoom}
      style={{ height, width: '100%' }}
      scrollWheelZoom={false}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />
      {geofences.map((g) => {
        const color = g.is_exclusion ? '#ef4444' : (g.geofence_type === 'BLE_DOMICILE' ? '#3b82f6' : '#10b981');
        const opacity = g.is_exclusion ? 0.12 : 0.15;

        if (g.shape_type === 'CIRCLE' && g.center_lat && g.center_lon && g.radius_m) {
          return (
            <Circle
              key={g.id}
              center={[g.center_lat, g.center_lon]}
              radius={g.radius_m}
              pathOptions={{ color, fillColor: color, fillOpacity: opacity, weight: 2 }}
            >
              <Tooltip permanent={false} sticky>{g.name}</Tooltip>
            </Circle>
          );
        }
        if (g.shape_type === 'POLYGON' && g.area) {
          const positions = g.area.coordinates[0].map(([lng, lat]) => [lat, lng] as [number, number]);
          return (
            <Polygon
              key={g.id}
              positions={positions}
              pathOptions={{ color, fillColor: color, fillOpacity: opacity, weight: 2 }}
            >
              <Tooltip permanent={false} sticky>{g.name}</Tooltip>
            </Polygon>
          );
        }
        return null;
      })}
    </MapContainer>
  );
}
