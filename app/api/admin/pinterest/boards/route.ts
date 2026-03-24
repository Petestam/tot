import { NextResponse } from 'next/server';
import { requireAdminJson } from '@/lib/require-admin';
import { getPinterestAccessTokenFromDb } from '@/lib/pinterest-token';
import { fetchAllBoards } from '@/lib/pinterest-api';

export async function GET() {
  const denied = await requireAdminJson();
  if (denied) return denied;

  const token = await getPinterestAccessTokenFromDb();
  if (!token) {
    return NextResponse.json({ error: 'Connect Pinterest first' }, { status: 400 });
  }

  try {
    const boards = await fetchAllBoards(token);
    return NextResponse.json({ boards });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to fetch boards' },
      { status: 500 }
    );
  }
}
