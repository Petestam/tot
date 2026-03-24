import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminJson } from '@/lib/require-admin';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAdminJson();
  if (denied) return denied;

  const { id: instanceId } = await params;

  const exists = await prisma.gameInstance.findUnique({
    where: { id: instanceId },
    select: { id: true },
  });
  if (!exists) {
    return NextResponse.json({ error: 'Instance not found' }, { status: 404 });
  }

  const [picks, rejects, pins] = await Promise.all([
    prisma.choice.groupBy({
      by: ['pickedPinId'],
      where: { session: { instanceId } },
      _count: { _all: true },
    }),
    prisma.choice.groupBy({
      by: ['notPickedPinId'],
      where: { session: { instanceId } },
      _count: { _all: true },
    }),
    prisma.pin.findMany({
      where: { instanceId },
      select: { id: true, title: true, imageUrl: true, pinterestPinId: true },
    }),
  ]);

  const stats = new Map<
    string,
    { positive: number; negative: number; appearances: number; winRate: number | null }
  >();

  for (const p of pins) {
    stats.set(p.id, { positive: 0, negative: 0, appearances: 0, winRate: null });
  }

  for (const row of picks) {
    const s = stats.get(row.pickedPinId);
    if (s) {
      s.positive = row._count._all;
    }
  }
  for (const row of rejects) {
    const s = stats.get(row.notPickedPinId);
    if (s) {
      s.negative = row._count._all;
    }
  }

  const rows = pins.map((p) => {
    const s = stats.get(p.id)!;
    s.appearances = s.positive + s.negative;
    s.winRate = s.appearances > 0 ? s.positive / s.appearances : null;
    return {
      pinId: p.id,
      title: p.title,
      imageUrl: p.imageUrl,
      positive: s.positive,
      negative: s.negative,
      appearances: s.appearances,
      winRate: s.winRate,
    };
  });

  rows.sort((a, b) => (b.winRate ?? -1) - (a.winRate ?? -1));

  const totalChoices = await prisma.choice.count({
    where: { session: { instanceId } },
  });

  return NextResponse.json({
    totalChoices,
    pins: rows,
  });
}
