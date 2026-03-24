import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { prisma } from '@/lib/prisma';
import { requireAdminJson } from '@/lib/require-admin';

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
  return base || `game-${nanoid(8)}`;
}

export async function GET() {
  const denied = await requireAdminJson();
  if (denied) return denied;

  const instances = await prisma.gameInstance.findMany({
    orderBy: { updatedAt: 'desc' },
    include: {
      _count: { select: { pins: true, sessions: true } },
    },
  });

  return NextResponse.json({
    instances: instances.map((i) => ({
      id: i.id,
      slug: i.slug,
      name: i.name,
      pinterestBoardId: i.pinterestBoardId,
      lastSyncedAt: i.lastSyncedAt?.toISOString() ?? null,
      archivedAt: i.archivedAt?.toISOString() ?? null,
      notes: i.notes,
      pinCount: i._count.pins,
      sessionCount: i._count.sessions,
    })),
  });
}

export async function POST(req: NextRequest) {
  const denied = await requireAdminJson();
  if (denied) return denied;

  const body = (await req.json()) as {
    name?: string;
    pinterestBoardId?: string;
    slug?: string;
    notes?: string;
  };

  if (!body.name?.trim() || !body.pinterestBoardId?.trim()) {
    return NextResponse.json({ error: 'name and pinterestBoardId required' }, { status: 400 });
  }

  let slug = body.slug?.trim() || slugify(body.name);
  const exists = await prisma.gameInstance.findUnique({ where: { slug } });
  if (exists) {
    slug = `${slug}-${nanoid(6)}`;
  }

  const instance = await prisma.gameInstance.create({
    data: {
      name: body.name.trim(),
      pinterestBoardId: body.pinterestBoardId.trim(),
      slug,
      notes: body.notes?.trim() || null,
    },
  });

  return NextResponse.json({
    instance: {
      id: instance.id,
      slug: instance.slug,
      name: instance.name,
      pinterestBoardId: instance.pinterestBoardId,
    },
  });
}
