import { NextRequest, NextResponse } from 'next/server';
import { createAdminToken } from '@/lib/admin-auth';
import { isGoogleEmailAllowed, verifyGoogleIdToken } from '@/lib/google-verify';

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { credential?: string };
  const credential = body.credential;
  if (!credential) {
    return NextResponse.json({ error: 'Missing credential' }, { status: 400 });
  }

  try {
    const { email } = await verifyGoogleIdToken(credential);
    if (!isGoogleEmailAllowed(email)) {
      return NextResponse.json(
        { error: 'This Google account is not allowed. Add your email to GOOGLE_ALLOWED_EMAILS in .env.' },
        { status: 403 }
      );
    }

    const token = await createAdminToken();
    const res = NextResponse.json({ ok: true, email });
    res.cookies.set('tot_admin', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });
    return res;
  } catch (e) {
    console.error('Google auth error:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Google sign-in failed' },
      { status: 401 }
    );
  }
}
