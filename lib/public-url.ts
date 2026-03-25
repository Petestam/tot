import type { NextRequest } from 'next/server';

/**
 * Public origin for OAuth redirect_uri — derived from the incoming request (Vercel forwards
 * x-forwarded-host / x-forwarded-proto). Falls back to VERCEL_URL on Vercel if Host is missing.
 * Optional NEXT_PUBLIC_APP_URL only when you must override broken proxy headers (avoid on Vercel
 * if you use preview deployments — it would pin OAuth to one host).
 */
export function publicOriginFromRequest(req: NextRequest): string {
  const hostFromForward =
    req.headers.get('x-forwarded-host')?.split(',')[0]?.trim() || '';
  const hostHeader = req.headers.get('host')?.trim() || '';
  const host = hostFromForward || hostHeader;

  if (host) {
    let proto = req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
    if (!proto) {
      proto = host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https';
    }
    return `${proto}://${host}`;
  }

  const vercel = process.env.VERCEL_URL?.replace(/\/$/, '').trim();
  if (vercel) {
    return `https://${vercel}`;
  }

  const override = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '').trim();
  if (override) return override;

  return 'http://localhost:3000';
}

export function pinterestOAuthRedirectUri(req: NextRequest): string {
  return `${publicOriginFromRequest(req)}/api/auth/pinterest/callback`;
}
