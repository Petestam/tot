import { NextResponse } from 'next/server';
import { requireAdminJson } from '@/lib/require-admin';
import { getPinterestAccessTokenFromDb } from '@/lib/pinterest-token';
import { fetchPinterestUserAccount } from '@/lib/pinterest-user';

export async function GET() {
  const denied = await requireAdminJson();
  if (denied) return denied;

  const token = await getPinterestAccessTokenFromDb();
  if (!token) {
    return NextResponse.json({ connected: false });
  }

  const result = await fetchPinterestUserAccount(token);
  if (!result.ok) {
    if (result.status === 401) {
      return NextResponse.json({
        connected: true,
        tokenInvalid: true,
        message: 'Pinterest session expired — disconnect and connect again.',
      });
    }
    if (result.status === 403) {
      return NextResponse.json({
        connected: true,
        profileUnavailable: true,
        message:
          'Cannot read profile (missing user_accounts:read). Disconnect and connect again; the app now requests this scope.',
      });
    }
    return NextResponse.json({
      connected: true,
      stale: true,
      message: `Could not load profile (HTTP ${result.status}). Try disconnect and reconnect.`,
    });
  }

  const a = result.account;
  const label = a.username || (a.id ? `id ${a.id}` : null);
  if (!label) {
    return NextResponse.json({
      connected: true,
      stale: true,
      message: 'Profile response had no username — try disconnect and connect again.',
    });
  }

  return NextResponse.json({
    connected: true,
    username: a.username ?? null,
    accountId: a.id ?? null,
    profileImage: a.profile_image ?? null,
    accountType: a.account_type ?? null,
    businessName: a.business_name ?? null,
  });
}
