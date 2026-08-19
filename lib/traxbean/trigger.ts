// Déclencheur de collecte, côté application.
//
// Le collecteur `/api/cron/poll-traxbean` est ce qui fait entrer les positions
// et la télémétrie dans la base. Jusqu'ici, deux choses seulement l'appelaient :
// le cron Vercel (une fois par jour sur l'offre Hobby) et la carte de suivi
// pendant qu'un opérateur la regardait. Résultat : hors de la carte, la fiche
// bracelet et la console de supervision affichaient l'état figé du dernier
// passage — parfois vieux de plusieurs semaines.
//
// Ce module rend le déclenchement disponible partout, avec deux garde-fous :
//   · un intervalle minimum, pour que dix pages ouvertes ne lancent pas dix
//     collectes (le compteur est par instance : c'est un frein, pas un verrou) ;
//   · l'origine passée par l'appelant plutôt que NEXT_PUBLIC_SITE_URL, qui
//     pointe vers l'hôte configuré et non vers celui qui sert la requête.

import { headers } from 'next/headers';

let lastTriggeredAt = 0;

// Origine réelle de la requête en cours (protocole + hôte servant la page).
export async function requestOrigin(): Promise<string | null> {
  try {
    const h = await headers();
    const host = h.get('x-forwarded-host') ?? h.get('host');
    if (!host) return null;
    const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
    return `${proto}://${host}`;
  } catch {
    return null;
  }
}

// Lance une collecte si la précédente est plus vieille que `minIntervalMs`.
// Renvoie true si elle a été lancée. Silencieux par construction : une collecte
// ratée ne doit jamais empêcher une page de s'afficher.
export async function triggerTraxbeanPoll(origin: string | null, minIntervalMs = 20000): Promise<boolean> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return false; // mode démonstration
  const now = Date.now();
  if (now - lastTriggeredAt < minIntervalMs) return false;
  lastTriggeredAt = now;

  const base = origin ?? process.env.NEXT_PUBLIC_SITE_URL;
  if (!base) return false;
  const secret = process.env.CRON_SECRET ?? '';
  try {
    await fetch(`${base}/api/cron/poll-traxbean?secret=${encodeURIComponent(secret)}`, { cache: 'no-store' });
    return true;
  } catch {
    lastTriggeredAt = 0; // échec réseau : ne pas bloquer la tentative suivante
    return false;
  }
}
