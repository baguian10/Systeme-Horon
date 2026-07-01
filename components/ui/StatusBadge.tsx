import type { CaseStatus, AlertType, RiskLevel } from '@/lib/supabase/types';

const RISK_CONFIG: Record<RiskLevel, { label: string; className: string }> = {
  LOW:    { label: 'Risque faible',  className: 'bg-emerald-100 text-emerald-700' },
  MEDIUM: { label: 'Risque moyen',   className: 'bg-amber-100 text-amber-700' },
  HIGH:   { label: 'Risque élevé',   className: 'bg-red-100 text-red-700' },
};

export function RiskBadge({ level }: { level?: RiskLevel | null }) {
  const cfg = RISK_CONFIG[(level ?? 'MEDIUM') as RiskLevel] ?? RISK_CONFIG.MEDIUM;
  return <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${cfg.className}`}>{cfg.label}</span>;
}

const CASE_CONFIG: Record<CaseStatus, { label: string; className: string }> = {
  PENDING:    { label: 'En attente',  className: 'bg-yellow-100 text-yellow-700' },
  ACTIVE:     { label: 'Actif',       className: 'bg-green-100 text-green-700' },
  SUSPENDED:  { label: 'Suspendu',    className: 'bg-gray-100 text-gray-600' },
  TERMINATED: { label: 'Clôturé',     className: 'bg-slate-100 text-slate-600' },
  ARCHIVED:   { label: 'Archivé',     className: 'bg-gray-100 text-gray-500' },
  VIOLATION:  { label: 'Violation',   className: 'bg-red-100 text-red-700' },
};

const ALERT_CONFIG: Record<AlertType, { label: string; className: string }> = {
  GEOFENCE_EXIT:    { label: 'Sortie de zone',    className: 'bg-orange-100 text-orange-700' },
  CURFEW_VIOLATION: { label: 'Couvre-feu',        className: 'bg-violet-100 text-violet-700' },
  TAMPER_DETECTED:  { label: 'Sabotage',          className: 'bg-red-100 text-red-700' },
  HEALTH_CRITICAL:  { label: 'Santé critique',    className: 'bg-pink-100 text-pink-700' },
  BATTERY_LOW:      { label: 'Batterie faible',   className: 'bg-yellow-100 text-yellow-700' },
  SIGNAL_LOST:      { label: 'Signal perdu',      className: 'bg-gray-100 text-gray-600' },
  PANIC_BUTTON:     { label: 'Bouton panique',    className: 'bg-red-100 text-red-700' },
};

export function CaseStatusBadge({ status }: { status: CaseStatus }) {
  const { label, className } = CASE_CONFIG[status];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}

export function AlertTypeBadge({ type }: { type: AlertType }) {
  const { label, className } = ALERT_CONFIG[type];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}

const SEVERITY_COLORS = ['', 'bg-blue-500', 'bg-yellow-500', 'bg-orange-500', 'bg-red-500', 'bg-red-700'];

export function SeverityDot({ level }: { level: number }) {
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${SEVERITY_COLORS[level] ?? 'bg-gray-400'}`}
      title={`Sévérité ${level}/5`}
    />
  );
}
