import type { Pin, PlaySession } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { fisherYatesShuffle, randomBool } from '@/lib/game-shuffle';

export type PinDto = {
  id: string;
  imageUrl: string | null;
  videoUrl: string | null;
  title: string;
};

function parseOrderedIds(raw: string): string[] {
  try {
    const json = JSON.parse(raw) as unknown;
    if (!Array.isArray(json)) return [];
    return json.filter((x): x is string => typeof x === 'string');
  } catch {
    return [];
  }
}

export function nextPairFromOrder(
  orderedIds: string[],
  cursor: number
): { a: string; b: string } | null {
  if (cursor + 2 > orderedIds.length) return null;
  return { a: orderedIds[cursor]!, b: orderedIds[cursor + 1]! };
}

export function layoutPair(a: string, b: string): { leftPinId: string; rightPinId: string } {
  if (randomBool()) {
    return { leftPinId: a, rightPinId: b };
  }
  return { leftPinId: b, rightPinId: a };
}

export async function loadPinsMap(ids: string[]): Promise<Map<string, Pin>> {
  const pins = await prisma.pin.findMany({ where: { id: { in: ids } } });
  return new Map(pins.map((p) => [p.id, p]));
}

export function pinToDto(p: Pin): PinDto {
  return {
    id: p.id,
    imageUrl: p.imageUrl,
    videoUrl: p.videoUrl,
    title: p.title,
  };
}

export async function createPlaySession(
  instanceId: string,
  meta?: { ipAddress?: string | null; userAgent?: string | null; referrer?: string | null }
): Promise<{
  session: PlaySession;
  roundIndex: number;
  left: PinDto;
  right: PinDto;
}> {
  const inst = await prisma.gameInstance.findUnique({
    where: { id: instanceId },
    select: { id: true, archivedAt: true },
  });
  if (!inst) throw new Error('Game not found');
  if (inst.archivedAt) {
    throw new Error('This game is no longer available.');
  }

  const pins = await prisma.pin.findMany({
    where: {
      instanceId,
      OR: [
        { imageUrl: { not: null }, NOT: { imageUrl: '' } },
        { videoUrl: { not: null }, NOT: { videoUrl: '' } },
      ],
    },
    select: { id: true },
  });
  if (pins.length < 2) {
    const total = await prisma.pin.count({ where: { instanceId } });
    throw new Error(
      total === 0
        ? 'No pins in this game yet. In Admin, open your instance and click Sync.'
        : `Need at least 2 pins with media URLs (this game has ${total}). Add more pins to the Pinterest board and Sync again.`
    );
  }

  const orderedIds = fisherYatesShuffle(pins.map((p) => p.id));
  const first = nextPairFromOrder(orderedIds, 0);
  if (!first) throw new Error('No pair available');

  const layout = layoutPair(first.a, first.b);
  const pinMap = await loadPinsMap([layout.leftPinId, layout.rightPinId]);
  const left = pinMap.get(layout.leftPinId);
  const right = pinMap.get(layout.rightPinId);
  if (!left || !right) throw new Error('Pin rows missing');

  const session = await prisma.playSession.create({
    data: {
      instanceId,
      orderedPinIds: JSON.stringify(orderedIds),
      cursor: 0,
      currentLeftPinId: layout.leftPinId,
      currentRightPinId: layout.rightPinId,
      ipAddress: meta?.ipAddress ?? null,
      userAgent: meta?.userAgent ?? null,
      referrer: meta?.referrer ?? null,
    },
  });

  return {
    session,
    roundIndex: 0,
    left: pinToDto(left),
    right: pinToDto(right),
  };
}

export async function applyChoice(
  sessionId: string,
  pickedPinId: string
): Promise<
  | { done: true }
  | {
      done: false;
      roundIndex: number;
      left: PinDto;
      right: PinDto;
    }
> {
  const session = await prisma.playSession.findUnique({
    where: { id: sessionId },
    include: { instance: { select: { archivedAt: true } } },
  });
  if (!session) throw new Error('Session not found');
  if (session.instance.archivedAt) throw new Error('This game is no longer available.');

  const leftId = session.currentLeftPinId;
  const rightId = session.currentRightPinId;
  if (!leftId || !rightId) throw new Error('No active round');

  if (pickedPinId !== leftId && pickedPinId !== rightId) {
    throw new Error('Invalid pick');
  }

  const notPicked = pickedPinId === leftId ? rightId! : leftId!;
  const roundIndex = await prisma.choice.count({ where: { sessionId } });

  const nextCursor = session.cursor + 2;
  const orderedIds = parseOrderedIds(session.orderedPinIds);
  const nextPair = nextPairFromOrder(orderedIds, nextCursor);
  const layoutNext = nextPair ? layoutPair(nextPair.a, nextPair.b) : null;

  let nextLeftDto: PinDto | null = null;
  let nextRightDto: PinDto | null = null;
  if (layoutNext) {
    const pinMap = await loadPinsMap([layoutNext.leftPinId, layoutNext.rightPinId]);
    const l = pinMap.get(layoutNext.leftPinId);
    const r = pinMap.get(layoutNext.rightPinId);
    if (!l || !r) throw new Error('Pin rows missing');
    nextLeftDto = pinToDto(l);
    nextRightDto = pinToDto(r);
  }

  await prisma.$transaction(async (tx) => {
    await tx.choice.create({
      data: {
        sessionId,
        roundIndex,
        leftPinId: leftId,
        rightPinId: rightId,
        pickedPinId,
        notPickedPinId: notPicked,
      },
    });

    if (!layoutNext) {
      await tx.playSession.update({
        where: { id: sessionId },
        data: {
          cursor: nextCursor,
          currentLeftPinId: null,
          currentRightPinId: null,
        },
      });
    } else {
      await tx.playSession.update({
        where: { id: sessionId },
        data: {
          cursor: nextCursor,
          currentLeftPinId: layoutNext.leftPinId,
          currentRightPinId: layoutNext.rightPinId,
        },
      });
    }
  });

  if (!layoutNext || !nextLeftDto || !nextRightDto) {
    return { done: true };
  }

  return {
    done: false,
    roundIndex: roundIndex + 1,
    left: nextLeftDto,
    right: nextRightDto,
  };
}
