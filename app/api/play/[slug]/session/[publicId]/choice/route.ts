import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { applyChoice } from '@/lib/play-session';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; publicId: string }> }
) {
  const { slug, publicId } = await params;
  const instance = await prisma.gameInstance.findUnique({ where: { slug } });
  if (!instance) {
    return NextResponse.json({ error: 'Game not found' }, { status: 404 });
  }
  if (instance.archivedAt) {
    return NextResponse.json({ error: 'This game is no longer available.' }, { status: 410 });
  }

  const session = await prisma.playSession.findFirst({
    where: { publicId, instanceId: instance.id },
  });
  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as { pickedPinId?: string };
  if (!body.pickedPinId) {
    return NextResponse.json({ error: 'pickedPinId required' }, { status: 400 });
  }

  try {
    const result = await applyChoice(session.id, body.pickedPinId);
    if (result.done) {
      return NextResponse.json({ done: true });
    }
    return NextResponse.json({
      done: false,
      roundIndex: result.roundIndex,
      left: result.left,
      right: result.right,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Choice failed';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
