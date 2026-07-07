'use client';

import { useState, useTransition } from 'react';
import { XCircle, CheckCircle } from 'lucide-react';
import { toggleTigSiteAction } from '@/app/sigep/dashboard/tig-sites/actions';

interface Props {
  siteId: string;
  siteName: string;
  isActive: boolean;
}

export default function ToggleTigSiteButton({ siteId, siteName, isActive }: Props) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    const action = isActive ? 'désactiver' : 'réactiver';
    if (!confirm(`Voulez-vous ${action} « ${siteName} » ?`)) return;
    setError(null);
    const fd = new FormData();
    fd.set('site_id', siteId);
    fd.set('is_active', String(isActive));
    start(async () => {
      const result = await toggleTigSiteAction(fd);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <span className="flex flex-col items-end gap-1">
      {isActive ? (
        <button
          onClick={handleClick}
          disabled={pending}
          title="Désactiver ce site"
          className="text-gray-300 hover:text-red-400 disabled:opacity-40 transition-colors"
        >
          <XCircle className="w-4 h-4" />
        </button>
      ) : (
        <button
          onClick={handleClick}
          disabled={pending}
          className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:underline disabled:opacity-40"
        >
          <CheckCircle className="w-3.5 h-3.5" />
          {pending ? '…' : 'Réactiver'}
        </button>
      )}
      {error && (
        <span className="text-[10px] text-red-600 text-right max-w-[180px] leading-tight">{error}</span>
      )}
    </span>
  );
}
