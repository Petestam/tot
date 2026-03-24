import { OAuth2Client } from 'google-auth-library';

const client = new OAuth2Client();

export function isGoogleEmailAllowed(email: string | undefined | null): boolean {
  if (!email) return false;
  const raw = process.env.GOOGLE_ALLOWED_EMAILS?.trim();
  if (!raw) {
    console.warn('GOOGLE_ALLOWED_EMAILS is not set — Google sign-in disabled');
    return false;
  }
  const allowed = raw.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
  return allowed.includes(email.toLowerCase());
}

export async function verifyGoogleIdToken(idToken: string): Promise<{ email: string; name?: string }> {
  const audience = process.env.GOOGLE_CLIENT_ID;
  if (!audience) {
    throw new Error('GOOGLE_CLIENT_ID is not configured');
  }
  const ticket = await client.verifyIdToken({
    idToken,
    audience,
  });
  const payload = ticket.getPayload();
  const email = payload?.email;
  if (!email) {
    throw new Error('No email in Google token');
  }
  return { email, name: payload?.name };
}
