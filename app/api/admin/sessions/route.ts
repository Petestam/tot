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
