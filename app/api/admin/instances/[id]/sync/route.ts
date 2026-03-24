import { NextRequest, NextResponse } from 'next/server';
import { requireAdminJson } from '@/lib/require-admin';
import { getPinterestAccessTokenFromDb } from '@/lib/pinterest-token';
import { syncInstancePins } from '@/lib/sync-instance';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAdminJson();
  if (denied) return denied;

  const { id } = await params;
  const token = await getPinterestAccessTokenFromDb();
  if (!token) {
    return NextResponse.json({ error: 'Connect Pinterest first' }, { status: 400 });
  }

  try {
    const { count } = await syncInstancePins(id, token);
    return NextResponse.json({ ok: true, count });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Sync failed' },
      { status: 500 }
    );
  }
}
