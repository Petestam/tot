import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/admin-auth';
import { getPinterestAccessTokenFromDb } from '@/lib/pinterest-token';

/**
 * Returns the raw JSON from `GET https://api.pinterest.com/v5/pins/{id}` for debugging
 * (e.g. Shift+D on the play page). Protects your Pinterest token.
 *
 * Allowed when: NODE_ENV=development, or signed-in admin (`/admin` cookie).
 */
export async function GET(req: NextRequest) {
  const dev = process.env.NODE_ENV === 'development';
  if (!dev && !(await getAdminSession())) {
    return NextResponse.json({ error: 'Unauthorized — log into /admin or run locally.' }, { status: 401 });
  }

  const pinterestPinId = req.nextUrl.searchParams.get('pinterestPinId');
  if (!pinterestPinId?.trim()) {
    return NextResponse.json({ error: 'pinterestPinId query param required' }, { status: 400 });
  }

  const token = await getPinterestAccessTokenFromDb();
  if (!token) {
    return NextResponse.json({ error: 'Pinterest not connected (admin OAuth).' }, { status: 503 });
  }

  const url = `https://api.pinterest.com/v5/pins/${encodeURIComponent(pinterestPinId.trim())}`;
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const text = await r.text();
  let pin: unknown;
  try {
    pin = text ? (JSON.parse(text) as unknown) : null;
  } catch {
    pin = { _parseError: 'Response was not JSON', raw: text.slice(0, 8000) };
  }

  return NextResponse.json({
    requestUrl: url,
    pinterestHttpStatus: r.status,
    pinterestOk: r.ok,
    pin,
  });
}
