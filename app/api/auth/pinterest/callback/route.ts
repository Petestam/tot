import { NextRequest, NextResponse } from 'next/server';
import { savePinterestTokens } from '@/lib/pinterest-token';

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  if (!code) {
    return new NextResponse('Missing code', { status: 400 });
  }

  const clientId = process.env.PINTEREST_APP_ID;
  const clientSecret = process.env.PINTEREST_APP_SECRET;
  const protocol = req.headers.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
  const host = req.headers.get('host') || 'localhost:3000';
  const redirectUri = `${protocol}://${host}/api/auth/pinterest/callback`;

  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: 'Pinterest not configured' }, { status: 500 });
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

  const data = (await tokenRes.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    message?: string;
    code?: number;
  };

  if (!tokenRes.ok) {
    console.error('Pinterest token error:', data);
    return NextResponse.json(
      { error: data.message || 'Token exchange failed' },
      { status: 500 }
    );
  }

  const accessToken = data.access_token;
  if (!accessToken) {
    return NextResponse.json({ error: 'No access token' }, { status: 500 });
  }

  await savePinterestTokens(
    accessToken,
    data.refresh_token ?? null,
    data.expires_in
  );

  return NextResponse.redirect(new URL('/admin?pinterest=connected', req.url));
}
