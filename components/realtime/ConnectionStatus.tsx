'use client';

import { useConnectionStatus } from '@/hooks/useConnectionStatus';

const CONFIG = {
  live:       { dot: 'bg-green-400 animate-pulse', label: 'LIVE', text: 'text-green-600', bg: 'bg-green-50 border-green-200' },
  demo:       { dot: 'bg-amber-400',               label: 'DÉMO', text: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
  connecting: { dot: 'bg-blue-400 animate-pulse',  label: '...',  text: 'text-blue-600',  bg: 'bg-blue-50 border-blue-200' },
  error:      { dot: 'bg-red-500',                 label: 'ERR',  text: 'text-red-600',   bg: 'bg-red-50 border-red-200' },
};

export default function ConnectionStatus() {
  const state = useConnectionStatus();
  const { dot, label, text, bg } = CONFIG[state];

  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${bg} ${text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {label}
    </div>
  );
}
