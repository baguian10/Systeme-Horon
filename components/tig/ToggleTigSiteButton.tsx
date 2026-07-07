'use client';

import { useTransition } from 'react';
import { XCircle, CheckCircle } from 'lucide-react';
import { toggleTigSiteAction } from '@/app/sigep/dashboard/tig-sites/actions';

interface Props {
  siteId: string;
  siteName: string;
  isActive: boolean;
}

export default function ToggleTigSiteButton({ siteId, siteName, isActive }: Props) {
  const [pending, start] = useTransition();

  function handleClick() {
    const action = isActive ? 'désactiver' : 'réactiver';
    if (!confirm(`Voulez-vous ${action} « ${siteName} » ?`)) return;
    const fd = new FormData();
    fd.set('site_id', siteId);
    fd.set('is_active', String(isActive));
    start(async () => { await toggleTigSiteAction(fd); });
  }

  if (isActive) {
    return (
      <button
        onClick={handleClick}
        disabled={pending}
        title="Désactiver ce site"
        className="text-gray-300 hover:text-red-400 disabled:opacity-40 transition-colors"
      >
        <XCircle className="w-4 h-4" />
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={pending}
      className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:underline disabled:opacity-40"
    >
      <CheckCircle className="w-3.5 h-3.5" />
      {pending ? '…' : 'Réactiver'}
    </button>
  );
}
