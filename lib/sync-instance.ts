import { prisma } from '@/lib/prisma';
import { fetchAllBoardPins } from '@/lib/pinterest-api';

export async function syncInstancePins(instanceId: string, accessToken: string): Promise<{ count: number }> {
  const instance = await prisma.gameInstance.findUnique({ where: { id: instanceId } });
  if (!instance) throw new Error('Instance not found');

  const items = await fetchAllBoardPins(accessToken, instance.pinterestBoardId);

  const chunkSize = 40;
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    await prisma.$transaction(
      chunk.map((p) =>
        prisma.pin.upsert({
          where: {
            instanceId_pinterestPinId: {
              instanceId,
              pinterestPinId: p.id,
            },
          },
          create: {
            instanceId,
            pinterestPinId: p.id,
            imageUrl: p.imageUrl,
            title: p.title,
            width: p.width ?? null,
            height: p.height ?? null,
          },
          update: {
            imageUrl: p.imageUrl,
            title: p.title,
            width: p.width ?? null,
            height: p.height ?? null,
          },
        })
      )
    );
  }

  await prisma.gameInstance.update({
    where: { id: instanceId },
    data: { lastSyncedAt: new Date() },
  });

  return { count: items.length };
}

export async function syncAllInstances(accessToken: string): Promise<{ id: string; ok: boolean; error?: string }[]> {
  const instances = await prisma.gameInstance.findMany({
    where: { archivedAt: null },
    select: { id: true },
  });
  const results: { id: string; ok: boolean; error?: string }[] = [];
  for (const { id } of instances) {
    try {
      await syncInstancePins(id, accessToken);
      results.push({ id, ok: true });
    } catch (e) {
      results.push({
        id,
        ok: false,
        error: e instanceof Error ? e.message : 'Sync failed',
      });
    }
  }
  return results;
}
