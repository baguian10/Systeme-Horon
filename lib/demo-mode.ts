// Single, server-safe source of truth for "is this deployment a demonstration?".
//
// A deployment without a Supabase backend can only serve fabricated data, so it
// must identify itself as a demonstration. That is exactly how the two Vercel
// projects are told apart: `systeme-horon` (the real site) carries the Supabase
// environment variables, `sigep-presentation` (the demo) carries none.
//
// Kept in its own module — free of `'use client'` and of any heavy import — so
// Server Components can read it directly. Do not import IS_DEMO_MODE from
// `lib/supabase/client.ts` in a Server Component: that module is a client
// boundary and its exported value does not cross it reliably.
export const IS_DEMO_MODE =
  !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
