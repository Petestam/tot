import { NextResponse } from 'next/server';
import { requireAdminJson } from '@/lib/require-admin';
import { clearPinterestCredentials } from '@/lib/pinterest-token';

export async function POST() {
  const denied = await requireAdminJson();
  if (denied) return denied;

  await clearPinterestCredentials();
  return NextResponse.json({ ok: true });
}
