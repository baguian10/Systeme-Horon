export type UserRole = 'SUPER_ADMIN' | 'STRATEGIC' | 'JUDGE' | 'OPERATIONAL';
export type CaseStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'TERMINATED' | 'VIOLATION';
export type AlertType =
  | 'GEOFENCE_EXIT'
  | 'TAMPER_DETECTED'
  | 'HEALTH_CRITICAL'
  | 'BATTERY_LOW'
  | 'SIGNAL_LOST'
  | 'PANIC_BUTTON';

export interface User {
  id: string;
  auth_id: string;
  role: UserRole;
  full_name: string;
  badge_number: string | null;
  jurisdiction: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  access_scope?: 'FULL' | 'RESTRICTED' | null;
}

export interface Individual {
  id: string;
  national_id: string;
  full_name: string;
  date_of_birth: string;
  address: string | null;
  created_at: string;
}

export interface Device {
  id: string;
  case_id: string | null;
  imei: string;
  model: string;
  firmware_ver: string | null;
  battery_pct: number | null;
  is_online: boolean;
  last_seen_at: string | null;
  assigned_at: string | null;
  created_at: string;
}

export type GeofenceType  = 'GPS_ZONE' | 'BLE_DOMICILE';
export type GeofenceShape = 'POLYGON'  | 'CIRCLE';

export interface Geofence {
  id: string;
  case_id: string;
  device_id?: string | null;
  name: string;
  geofence_type: GeofenceType;
  shape_type: GeofenceShape;
  is_exclusion: boolean;
  // Polygon mode (shape_type === 'POLYGON')
  area: { type: 'Polygon'; coordinates: number[][][] } | null;
  // Circle mode (shape_type === 'CIRCLE')
  center_lat: number | null;
  center_lon: number | null;
  radius_m: number | null;
  active_start: string | null;
  active_end: string | null;
  created_by: string;
  created_at: string;
}

export interface Position {
  id: string;
  device_id: string;
  case_id: string;
  latitude: number;
  longitude: number;
  accuracy_m: number | null;
  speed_kmh: number | null;
  recorded_at: string;
}

export interface Alert {
  id: string;
  case_id: string;
  device_id: string;
  alert_type: AlertType;
  severity: number;
  description: string | null;
  position_lat: number | null;
  position_lon: number | null;
  is_resolved: boolean;
  resolved_by: string | null;
  resolved_at: string | null;
  triggered_at: string;
  case?: Case;
  device?: Device;
  resolver?: User;
}

export interface Case {
  id: string;
  individual_id: string;
  judge_id: string;
  case_number: string;
  status: CaseStatus;
  court_order_date: string;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  individual?: Individual;
  judge?: User;
  device?: Device;
  alerts?: Alert[];
  alert_count?: number;
  geofences?: Geofence[];
  last_position?: Position | null;
}

export interface CaseAssignment {
  case_id: string;
  operational_id: string;
  assigned_by: string;
  assigned_at: string;
}

export interface SessionUser {
  id: string;
  auth_id: string;
  role: UserRole;
  full_name: string;
  badge_number: string | null;
  jurisdiction: string | null;
}

export interface OverviewStats {
  active_cases: number;
  active_alerts: number;
  devices_online: number;
  monitored_individuals: number;
  violation_cases: number;
}
