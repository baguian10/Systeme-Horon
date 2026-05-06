import type { ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: number | string;
  icon: ReactNode;
  accent?: 'blue' | 'red' | 'green' | 'orange';
  sub?: string;
}

const ACCENTS = {
  blue:   'border-blue-500 bg-blue-50 text-blue-600',
  red:    'border-red-500 bg-red-50 text-red-600',
  green:  'border-green-500 bg-green-50 text-green-600',
  orange: 'border-orange-500 bg-orange-50 text-orange-600',
};

export default function StatCard({ label, value, icon, accent = 'blue', sub }: StatCardProps) {
  const accentClass = ACCENTS[accent];
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 flex items-start gap-4">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center border ${accentClass} flex-shrink-0`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-gray-900 leading-tight">{value}</p>
        <p className="text-sm font-medium text-gray-600 mt-0.5">{label}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}
