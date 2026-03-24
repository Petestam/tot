import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const COOKIE = 'tot_admin';

function secretKey(): Uint8Array {
  const s = process.env.ADMIN_SECRET;
  if (!s || s.length < 16) {
    throw new Error('ADMIN_SECRET must be set (min 16 chars)');
  }
  return new TextEncoder().encode(s);
}

export async function createAdminToken(): Promise<string> {
  return new SignJWT({ role: 'admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secretKey());
}

export async function verifyAdminToken(token: string): Promise<boolean> {
  try {
    await jwtVerify(token, secretKey());
    return true;
  } catch {
    return false;
  }
}

export async function getAdminSession(): Promise<boolean> {
  const c = await cookies();
  const t = c.get(COOKIE)?.value;
  if (!t) return false;
  return verifyAdminToken(t);
}

export async function setAdminCookie(token: string): Promise<void> {
  const c = await cookies();
  c.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearAdminCookie(): Promise<void> {
  const c = await cookies();
  c.set(COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
}

export { COOKIE as ADMIN_COOKIE_NAME };
