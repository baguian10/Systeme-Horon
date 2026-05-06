'use client';

import { useTransition } from 'react';
import { toggleUserActiveAction } from '@/app/sigep/dashboard/users/actions';

interface Props {
  userId: string;
  isActive: boolean;
}

export default function ToggleUserButton({ userId, isActive }: Props) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    const fd = new FormData();
    fd.set('user_id', userId);
    fd.set('next_active', String(!isActive));
    startTransition(() => toggleUserActiveAction(fd));
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className={`text-xs font-medium px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50 ${
        isActive
          ? 'text-red-600 bg-red-50 hover:bg-red-100'
          : 'text-green-700 bg-green-50 hover:bg-green-100'
      }`}
    >
      {isPending ? '...' : isActive ? 'Désactiver' : 'Réactiver'}
    </button>
  );
}
