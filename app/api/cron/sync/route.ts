import { NextRequest, NextResponse } from 'next/server';
import { getPinterestAccessTokenFromDb } from '@/lib/pinterest-token';
import { syncAllInstances } from '@/lib/sync-instance';

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET not set' }, { status: 500 });
  }

  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = await getPinterestAccessTokenFromDb();
  if (!token) {
    return NextResponse.json({ error: 'No Pinterest token stored' }, { status: 400 });
  }

  const results = await syncAllInstances(token);
  return NextResponse.json({ ok: true, results });
}
