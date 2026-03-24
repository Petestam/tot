import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/admin-auth';

export async function requireAdminJson(): Promise<NextResponse | null> {
  const ok = await getAdminSession();
  if (!ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}
