import type { Pin, PlaySession } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { fisherYatesShuffle, randomBool } from '@/lib/game-shuffle';
import { hasRenderableMediaUrl, sanitizeImageUrl, sanitizeVideoUrl } from '@/lib/media-url';
import { getPinterestAccessTokenFromDb } from '@/lib/pinterest-token';

export type PinDto = {
  id: string;
  pinterestPinId: string;
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
    pinterestPinId: p.pinterestPinId,
    imageUrl: sanitizeImageUrl(p.imageUrl),
    videoUrl: sanitizeVideoUrl(p.videoUrl),
    title: p.title,
  };
}

export type PreloadPairDto = { left: PinDto; right: PinDto };

/** Pins for the round after `currentCursor` (the pair at currentCursor+2..+3), with random left/right like a real round. */
async function buildPreloadPairDto(
  orderedIds: string[],
  currentCursor: number
): Promise<PreloadPairDto | null> {
  const nextPair = nextPairFromOrder(orderedIds, currentCursor + 2);
  if (!nextPair) return null;
  const layout = layoutPair(nextPair.a, nextPair.b);
  const pinMap = await loadPinsMap([layout.leftPinId, layout.rightPinId]);
  const l = pinMap.get(layout.leftPinId);
  const r = pinMap.get(layout.rightPinId);
  if (!l || !r) return null;
  return { left: pinToDto(l), right: pinToDto(r) };
}

type PinterestBoardUrlCacheEntry = { url: string; fetchedAtMs: number };
const pinterestBoardUrlCache = new Map<string, PinterestBoardUrlCacheEntry>();
const PINTEREST_BOARD_URL_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

function extractPinterestBoardUrlFromPinPayload(pinPayload: unknown, boardId: string): string | null {
  if (!pinPayload || typeof pinPayload !== 'object') return null;
  const payload = pinPayload as Record<string, unknown>;

  const maybeBoard = payload.board;
  if (maybeBoard && typeof maybeBoard === 'object') {
    const b = maybeBoard as Record<string, unknown>;
    for (const k of ['url', 'link', 'board_url', 'website_url']) {
      const candidate = b[k];
      if (typeof candidate === 'string' && /^https?:\/\//i.test(candidate) && candidate.includes(boardId)) {
        return candidate;
      }
    }
  }

  // Fallback: find any string that looks like a Pinterest board URL including the board id.
  const visited = new Set<unknown>();
  const visit = (v: unknown, depth: number): string | null => {
    if (depth > 6) return null;
    if (visited.has(v)) return null;
    visited.add(v);

    if (typeof v === 'string') {
      if (!v.includes('pinterest.com')) return null;
      if (!v.includes(boardId)) return null;
      if (v.includes('/boards/') || v.includes('/board/') || v.includes('/ideas/')) return v;
      return null;
    }

    if (Array.isArray(v)) {
      for (const el of v) {
        const found = visit(el, depth + 1);
        if (found) return found;
      }
      return null;
    }

    if (typeof v === 'object' && v !== null) {
      for (const val of Object.values(v as Record<string, unknown>)) {
        const found = visit(val, depth + 1);
        if (found) return found;
      }
    }

    return null;
  };

  return visit(pinPayload, 0);
}

export async function createPlaySession(
  instanceId: string,
  meta?: { ipAddress?: string | null; userAgent?: string | null; referrer?: string | null }
): Promise<{
  session: PlaySession;
  pinterestBoardId: string;
  pinterestBoardUrl: string | null;
  preloadNext: PreloadPairDto | null;
  roundIndex: number;
  left: PinDto;
  right: PinDto;
}> {
  const inst = await prisma.gameInstance.findUnique({
    where: { id: instanceId },
    select: { id: true, archivedAt: true, pinterestBoardId: true },
  });
  if (!inst) throw new Error('Game not found');
  if (inst.archivedAt) {
    throw new Error('This game is no longer available.');
  }

  const rawPins = await prisma.pin.findMany({
    where: {
      instanceId,
      OR: [
        { imageUrl: { not: null }, NOT: { imageUrl: '' } },
        { videoUrl: { not: null }, NOT: { videoUrl: '' } },
      ],
    },
    select: { id: true, imageUrl: true, videoUrl: true },
  });
  const pins = rawPins.filter((p) => hasRenderableMediaUrl(p.imageUrl, p.videoUrl));
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

  let pinterestBoardUrl: string | null = null;
  const boardId = inst.pinterestBoardId;
  const cached = pinterestBoardUrlCache.get(boardId);
  if (cached && Date.now() - cached.fetchedAtMs < PINTEREST_BOARD_URL_CACHE_TTL_MS) {
    pinterestBoardUrl = cached.url;
  } else {
    // Best-effort: fetch one pin payload to extract the parent board public URL.
    // This is cached per board to avoid extra Pinterest calls per session.
    const token = await getPinterestAccessTokenFromDb();
    if (token) {
      try {
        const pinIdForBoardUrl = left.pinterestPinId; // one request per cache miss
        const r = await fetch(`https://api.pinterest.com/v5/pins/${encodeURIComponent(pinIdForBoardUrl)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (r.ok) {
          const pinPayload = (await r.json()) as unknown;
          pinterestBoardUrl = extractPinterestBoardUrlFromPinPayload(pinPayload, boardId);
          if (pinterestBoardUrl) {
            pinterestBoardUrlCache.set(boardId, { url: pinterestBoardUrl, fetchedAtMs: Date.now() });
          }
        }
      } catch {
        // If Pinterest is rate-limiting/unavailable, the game can still play.
        pinterestBoardUrl = null;
      }
    }
  }

  const preloadNext = await buildPreloadPairDto(orderedIds, 0);

  return {
    session,
    pinterestBoardId: inst.pinterestBoardId,
    pinterestBoardUrl,
    preloadNext,
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
      preloadNext: PreloadPairDto | null;
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

  let preloadNextDto: PreloadPairDto | null = null;
  if (layoutNext) {
    preloadNextDto = await buildPreloadPairDto(orderedIds, nextCursor);
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
    preloadNext: preloadNextDto,
  };
}
