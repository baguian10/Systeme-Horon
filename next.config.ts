import type { NextConfig } from 'next';

const ContentSecurityPolicy = [
  "default-src 'self'",
  // Next.js requires 'unsafe-inline' for its runtime scripts
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  // Tailwind utility classes are injected at runtime
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://images.unsplash.com",
  "font-src 'self'",
  // Supabase REST + Realtime WebSocket
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

const nextConfig: NextConfig = {
  poweredByHeader: false,
  compress: true,
  images: {
    remotePatterns: [{ hostname: 'images.unsplash.com' }],
  },

  async headers() {
    return [
      // ── Global security headers ───────────────────────────────
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options',            value: 'DENY' },
          { key: 'X-Content-Type-Options',      value: 'nosniff' },
          { key: 'X-DNS-Prefetch-Control',      value: 'on' },
          { key: 'Referrer-Policy',             value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy',          value: 'camera=(), microphone=(), geolocation=()' },
          // HSTS: 2 years, include subdomains, eligible for preload list
          { key: 'Strict-Transport-Security',   value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'Content-Security-Policy',     value: ContentSecurityPolicy },
        ],
      },

      // ── SIGEP admin — never indexed, never cached ─────────────
      {
        source: '/sigep/(.*)',
        headers: [
          { key: 'X-Robots-Tag',    value: 'noindex, nofollow' },
          { key: 'Cache-Control',   value: 'private, no-cache, no-store, must-revalidate' },
          { key: 'Pragma',          value: 'no-cache' },
          { key: 'Expires',         value: '0' },
        ],
      },

      // ── Ingest API — no caching, auth required in production ──
      {
        source: '/api/ingest/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'no-store' },
        ],
      },

      // ── Static assets — immutable cache ──────────────────────
      {
        source: '/_next/static/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ];
  },
};

export default nextConfig;
