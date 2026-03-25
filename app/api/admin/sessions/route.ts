import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminJson } from '@/lib/require-admin';

export async function GET(req: NextRequest) {
  const denied = await requireAdminJson();
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const instanceId = searchParams.get('instanceId');

  if (!instanceId) {
    return NextResponse.json({ error: 'instanceId required' }, { status: 400 });
  }

  const sessions = await prisma.playSession.findMany({
    where: {
      instanceId,
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: {
      _count: { select: { choices: true } },
    },
  });

  return NextResponse.json({
    sessions: sessions.map((s) => ({
      id: s.id,
      publicId: s.publicId,
      createdAt: s.createdAt.toISOString(),
      choiceCount: s._count.choices,
      ipAddress: s.ipAddress,
    })),
  });
}

export async function DELETE(req: NextRequest) {
  const denied = await requireAdminJson();
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const instanceId = searchParams.get('instanceId');
  const mode = searchParams.get('mode');

  if (!instanceId) {
    return NextResponse.json({ error: 'instanceId required' }, { status: 400 });
  }
  if (!mode) {
    return NextResponse.json(
      { error: 'mode required: use mode=before&createdBefore=<ISO> or mode=all' },
      { status: 400 }
    );
  }

  if (mode === 'before') {
    const createdBefore = searchParams.get('createdBefore');
    if (!createdBefore) {
      return NextResponse.json({ error: 'createdBefore required for mode=before' }, { status: 400 });
    }
    const dt = new Date(createdBefore);
    if (Number.isNaN(dt.getTime())) {
      return NextResponse.json({ error: 'createdBefore must be a valid ISO datetime' }, { status: 400 });
    }

    const r = await prisma.playSession.deleteMany({
      where: { instanceId, createdAt: { lt: dt } },
    });

    return NextResponse.json({ ok: true, deletedCount: r.count });
  }

  if (mode === 'all') {
    const r = await prisma.playSession.deleteMany({
      where: { instanceId },
    });
    return NextResponse.json({ ok: true, deletedCount: r.count });
  }

  return NextResponse.json(
    { error: 'Invalid mode. Use mode=before&createdBefore=<ISO> or mode=all.' },
    { status: 400 }
  );
}
