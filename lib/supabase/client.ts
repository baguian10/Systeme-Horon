'use client';

import { createBrowserClient } from '@supabase/ssr';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const IS_DEMO_MODE = !url || !key;

export function createClient() {
  if (IS_DEMO_MODE) return null;
  return createBrowserClient(url!, key!);
}
