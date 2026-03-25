import { NextRequest, NextResponse } from 'next/server';
import { pinterestOAuthRedirectUri, publicOriginFromRequest } from '@/lib/public-url';

export const dynamic = 'force-dynamic';

function adminRedirect(req: NextRequest, query: string) {
  const origin = publicOriginFromRequest(req);
  return NextResponse.redirect(new URL(`/admin?${query}`, `${origin}/`));
}

export async function GET(req: NextRequest) {
  const redirectError = (msg: string) =>
    adminRedirect(req, `pinterest=error&msg=${encodeURIComponent(msg.slice(0, 400))}`);

  try {
    const code = req.nextUrl.searchParams.get('code');
    if (!code) {
      return redirectError('Missing OAuth code from Pinterest');
    }

    const errParam = req.nextUrl.searchParams.get('error');
    const errDesc = req.nextUrl.searchParams.get('error_description');
    if (errParam) {
      return redirectError(errDesc || errParam || 'Pinterest denied authorization');
    }

    const clientId = process.env.PINTEREST_APP_ID;
    const clientSecret = process.env.PINTEREST_APP_SECRET;
    const redirectUri = pinterestOAuthRedirectUri(req);

    if (!clientId || !clientSecret) {
      return redirectError(
        'Server env missing PINTEREST_APP_ID or PINTEREST_APP_SECRET (set both in Vercel)'
      );
    }

    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const tokenRes = await fetch('https://api.pinterest.com/v5/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }).toString(),
    });

    const raw = await tokenRes.text();
    let data: {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      message?: string;
      code?: number;
    };
    try {
      data = raw ? (JSON.parse(raw) as typeof data) : {};
    } catch {
      console.error('Pinterest token non-JSON:', raw.slice(0, 800));
      return redirectError('Invalid response from Pinterest (token step)');
    }

    if (!tokenRes.ok) {
      console.error('Pinterest token HTTP', tokenRes.status, data);
      const detail =
        typeof data.message === 'string'
          ? data.message
          : `Token exchange failed (${tokenRes.status}). redirect_uri used: ${redirectUri}`;
      return redirectError(detail);
    }

    const accessToken = data.access_token;
    if (!accessToken) {
      return redirectError('Pinterest returned no access_token');
    }

    try {
      const { savePinterestTokens } = await import('@/lib/pinterest-token');
      await savePinterestTokens(
        accessToken,
        data.refresh_token ?? null,
        data.expires_in
      );
    } catch (dbErr) {
      console.error('Pinterest token save:', dbErr);
      const m = dbErr instanceof Error ? dbErr.message : String(dbErr);
      if (/SQLITE|ENOENT|read-only|SQLITE_CANTOPEN/i.test(m)) {
        return redirectError(
          'Cannot save Pinterest login: Vercel needs a hosted database. Use PostgreSQL (Neon, etc.), set DATABASE_URL, and use provider postgresql in prisma/schema.prisma — SQLite files do not work on Vercel.'
        );
      }
      if (/TOKEN_ENCRYPTION_KEY|min 32/i.test(m)) {
        return redirectError(
          'Set TOKEN_ENCRYPTION_KEY in Vercel (at least 32 characters) to encrypt stored tokens.'
        );
      }
      throw dbErr;
    }

    return adminRedirect(req, 'pinterest=connected');
  } catch (e) {
    console.error('Pinterest callback:', e);
    const m = e instanceof Error ? e.message : 'Unknown error';
    return redirectError(m.length > 280 ? 'Unexpected server error during Pinterest callback' : m);
  }
}
