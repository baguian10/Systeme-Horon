import { NextResponse, type NextRequest } from 'next/server';
import type { CookieOptions } from '@supabase/ssr';

const IS_DEMO_MODE =
  !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const ACTIVITY_COOKIE = 'sigep_last_activity';

// settings.session_timeout_min, cached in-memory 5 min (module scope persists
// across requests within an instance) so we don't hit the DB on every request.
let timeoutCache: { value: number; at: number } | null = null;
async function getSessionTimeoutMin(): Promise<number> {
  if (timeoutCache && Date.now() - timeoutCache.at < 300_000) return timeoutCache.value;
  let v = 30;
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (url && key) {
      const r = await fetch(`${url}/rest/v1/system_settings?id=eq.1&select=session_timeout_min`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        cache: 'no-store',
      });
      if (r.ok) {
        const j = await r.json() as { session_timeout_min?: number }[];
        const n = j?.[0]?.session_timeout_min;
        if (typeof n === 'number' && n >= 5) v = n;
      }
    }
  } catch { /* fall back to default */ }
  timeoutCache = { value: v, at: Date.now() };
  return v;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Protect /sigep/dashboard/* routes
  if (!pathname.startsWith('/sigep/dashboard')) {
    return NextResponse.next();
  }

  // Allow through in demo mode — auth is handled at the session layer
  if (IS_DEMO_MODE) return NextResponse.next();

  const { createServerClient } = await import('@supabase/ssr');
  const response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = new URL('/sigep/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Enforce completed 2FA: an account that has a verified factor but whose
  // current session is still aal1 (password only) must finish the second step.
  // This closes the bypass of navigating straight to the dashboard after the
  // password step without ever verifying the TOTP code.
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.nextLevel === 'aal2' && aal.currentLevel !== 'aal2') {
    const loginUrl = new URL('/sigep/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Inactivity timeout (settings.session_timeout_min): each dashboard request
  // stamps an activity cookie; a gap longer than the configured timeout ends
  // the session and returns to login.
  const timeoutMin = await getSessionTimeoutMin();
  const lastRaw = request.cookies.get(ACTIVITY_COOKIE)?.value;
  const last = lastRaw ? Number(lastRaw) : null;
  if (last && Number.isFinite(last) && Date.now() - last > timeoutMin * 60_000) {
    await supabase.auth.signOut();
    const loginUrl = new URL('/sigep/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    loginUrl.searchParams.set('expired', '1');
    const redirect = NextResponse.redirect(loginUrl);
    redirect.cookies.set(ACTIVITY_COOKIE, '', { maxAge: 0, path: '/' });
    return redirect;
  }
  response.cookies.set(ACTIVITY_COOKIE, String(Date.now()), {
    httpOnly: true, sameSite: 'lax', secure: true, path: '/',
  });

  return response;
}

export const config = {
  matcher: ['/sigep/dashboard/:path*'],
};
