import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createPlaySession } from '@/lib/play-session';

function clientIp(req: NextRequest): string | null {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }
  return req.headers.get('x-real-ip');
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const instance = await prisma.gameInstance.findUnique({ where: { slug } });
  if (!instance) {
    return NextResponse.json({ error: 'Game not found' }, { status: 404 });
  }
  if (instance.archivedAt) {
    return NextResponse.json({ error: 'This game is no longer available.' }, { status: 410 });
  }

  try {
    const ip = clientIp(req);
    const ua = req.headers.get('user-agent');
    const ref = req.headers.get('referer');

    const { session, roundIndex, left, right } = await createPlaySession(instance.id, {
      ipAddress: ip,
      userAgent: ua,
      referrer: ref,
    });

    return NextResponse.json({
      publicId: session.publicId,
      roundIndex,
      left,
      right,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to start';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
