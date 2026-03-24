import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminJson } from '@/lib/require-admin';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAdminJson();
  if (denied) return denied;

  const { id } = await params;
  const i = await prisma.gameInstance.findUnique({
    where: { id },
    include: { _count: { select: { pins: true, sessions: true } } },
  });
  if (!i) {
    return NextResponse.json({ error: 'Instance not found' }, { status: 404 });
  }

  return NextResponse.json({
    instance: {
      id: i.id,
      slug: i.slug,
      name: i.name,
      pinterestBoardId: i.pinterestBoardId,
      lastSyncedAt: i.lastSyncedAt?.toISOString() ?? null,
      archivedAt: i.archivedAt?.toISOString() ?? null,
      pinCount: i._count.pins,
      sessionCount: i._count.sessions,
    },
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAdminJson();
  if (denied) return denied;

  const { id } = await params;
  const body = (await req.json()) as { name?: string; notes?: string; archived?: boolean };

  const data: {
    name?: string;
    notes?: string | null;
    archivedAt?: Date | null;
  } = {};
  if (body.name !== undefined) data.name = body.name.trim();
  if (body.notes !== undefined) data.notes = body.notes?.trim() || null;
  if (body.archived === true) data.archivedAt = new Date();
  if (body.archived === false) data.archivedAt = null;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No valid fields' }, { status: 400 });
  }

  const instance = await prisma.gameInstance.update({
    where: { id },
    data,
  });

  return NextResponse.json({ instance });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAdminJson();
  if (denied) return denied;

  const { id } = await params;
  await prisma.gameInstance.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
