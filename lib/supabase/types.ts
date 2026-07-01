export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'STRATEGIC' | 'JUDGE' | 'OPERATIONAL';
export type CaseStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'TERMINATED' | 'VIOLATION' | 'ARCHIVED';
export type AlertType =
  | 'GEOFENCE_EXIT'
  | 'CURFEW_VIOLATION'
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
  permissions?: string[];
  department_id?: string | null;
}

export interface Individual {
  id: string;
  national_id: string;
  full_name: string;
  date_of_birth: string;
  address: string | null;
  created_at: string;
}

export type NetworkProtocol = 'MQTT' | 'HTTPS' | 'TCP';
export type SyncStatus = 'SYNCED' | 'DELAYED' | 'LOST';

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
  // GPS tracker sync parameters
  report_interval_s: number | null;
  network_protocol: NetworkProtocol | null;
  sim_iccid: string | null;
  sim_number?: string | null;
  sim_carrier?: string | null;       // ORANGE | MOOV | TELECEL | OTHER
  sim_activated_at?: string | null;  // date mise en service
  sim_status?: string | null;        // ACTIVE | SUSPENDED
  // Voice communication (TR40 / ThinkRace IW)
  sos_numbers?: string[] | null;
  call_whitelist?: { name: string; phone: string }[] | null;
  call_enabled?: boolean | null;
  signal_strength_dbm: number | null;
  gps_accuracy_m: number | null;
  tamper_detected: boolean;
  geofences_synced: number | null;
  sync_status: SyncStatus | null;
  last_heartbeat_at: string | null;
  server_endpoint: string | null;
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
  status?: 'REQUESTED' | 'ACTIVE';
  defined_by?: string | null;
  request_note?: string | null;
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

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export type DepartmentType = 'COURT' | 'JURISDICTION' | 'UNIT';
export interface Department {
  id: string;
  name: string;
  type: DepartmentType;
  parent_id: string | null;
  created_at: string;
}

export type AlertStatus = 'NEW' | 'ACKNOWLEDGED' | 'IN_PROGRESS' | 'RESOLVED' | 'FALSE_ALARM';
export type ResolutionCategory = 'JUSTIFIED' | 'FALSE_ALARM' | 'TECHNICAL' | 'INTERVENTION';

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
  // Workflow (#3)
  status?: AlertStatus;
  assigned_to?: string | null;
  acknowledged_by?: string | null;
  acknowledged_at?: string | null;
  resolution_category?: ResolutionCategory | null;
  resolution_reason?: string | null;
  case?: Case;
  device?: Device;
  resolver?: User;
  assignee?: User;
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
  measure_type?: string | null;
  risk_level?: RiskLevel;
  department_id?: string | null;
  department?: { name: string } | null;
  legal_basis?: string | null;
  ordonnance_ref?: string | null;
  ordonnance_url?: string | null;
  obligations?: string | null;
  // Structured surveillance-measure conditions
  measure_kind?: MeasureKind | null;
  is_permanent?: boolean;
  curfew_days?: number[] | null;   // 0=Sun … 6=Sat
  curfew_start?: string | null;    // HH:MM[:SS]
  curfew_end?: string | null;
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

export type MeasureKind =
  | 'ASSIGNATION_DOMICILE' | 'DETENTION_DOMICILE' | 'TIG'
  | 'COUVRE_FEU' | 'INTERDICTION_ZONE' | 'LIBERTE_SURVEILLEE';

export type CaseRequestType =
  | 'DELETE' | 'ARCHIVE' | 'REACTIVATE' | 'EXTEND' | 'MODIFY_CONDITIONS' | 'TRANSFER_JURISDICTION';

export type CaseRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface CaseRequest {
  id: string;
  case_id: string;
  case_number?: string;
  individual_name?: string;
  request_type: CaseRequestType;
  requested_by: string | null;
  requested_by_name?: string;
  reason: string;
  payload?: Record<string, unknown> | null;
  status: CaseRequestStatus;
  decided_by?: string | null;
  decision_note?: string | null;
  decided_at?: string | null;
  created_at: string;
}

export interface SessionUser {
  id: string;
  auth_id: string;
  role: UserRole;
  full_name: string;
  badge_number: string | null;
  jurisdiction: string | null;
  permissions?: string[];
}

export interface OverviewStats {
  active_cases: number;
  active_alerts: number;
  devices_online: number;
  monitored_individuals: number;
  violation_cases: number;
}

export type TigSiteCategory = 'MAIRIE' | 'HOPITAL' | 'ECOLE' | 'ONG' | 'ESPACE_VERT' | 'AUTRE';

export interface TigSite {
  id: string;
  name: string;
  category: TigSiteCategory;
  address: string;
  arrondissement: string;
  contact_name: string;
  contact_phone: string;
  capacity: number;
  current_count: number;
  hours: string;
  is_active: boolean;
  latitude: number;
  longitude: number;
  created_at: string;
}

export type RevocationStatus  = 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED';
export type JournalEntryType  = 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE' | 'INCIDENT';
export type MaintenanceType   = 'BATTERY' | 'FIRMWARE' | 'HARDWARE' | 'CALIBRATION' | 'REPLACEMENT';
export type MaintenanceStatus = 'PENDING' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';
export type ObligationType    = 'TIG_SHIFT' | 'CURFEW_CHECK' | 'COURT_DATE' | 'MONITORING_VISIT';

export interface RevocationRequest {
  id: string;
  case_id: string;
  case_number: string;
  individual_name: string;
  requested_by_id: string;
  requested_by_name: string;
  reason: string;
  violation_count: number;
  status: RevocationStatus;
  judge_decision: string | null;
  decided_at: string | null;
  created_at: string;
}

export interface JournalEntry {
  id: string;
  case_id: string;
  author_id: string;
  author_name: string;
  author_role: UserRole;
  entry_type: JournalEntryType;
  content: string;
  created_at: string;
}

export interface MaintenanceTick {
  id: string;
  device_id: string;
  device_imei: string;
  maintenance_type: MaintenanceType;
  status: MaintenanceStatus;
  priority: 1 | 2 | 3;
  description: string;
  assigned_to: string | null;
  scheduled_at: string | null;
  completed_at: string | null;
  notes: string | null;
  created_at: string;
}

export interface AgendaObligation {
  id: string;
  case_id: string;
  case_number: string;
  individual_name: string;
  obligation_type: ObligationType;
  title: string;
  scheduled_date: string;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  is_confirmed: boolean;
}

export interface MessageThread {
  id: string;
  case_id: string | null;
  case_number: string | null;
  subject: string;
  participant_ids: string[];
  last_message_at: string;
  last_message_preview: string;
  created_by: string;
  created_at: string;
}

export interface Message {
  id: string;
  thread_id: string;
  sender_id: string;
  sender_name: string;
  sender_role: UserRole;
  content: string;
  is_read_by: string[];
  created_at: string;
}

export interface ViolationHeatPoint {
  lat: number;
  lng: number;
  intensity: number;
  alert_type: AlertType;
}
