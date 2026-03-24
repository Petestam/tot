import { prisma } from '@/lib/prisma';
import { decryptSecret, encryptSecret } from '@/lib/crypto-token';

const SINGLETON_ID = 'singleton';

export async function savePinterestTokens(
  accessToken: string,
  refreshToken?: string | null,
  expiresInSec?: number
): Promise<void> {
  const expiresAt =
    expiresInSec && Number.isFinite(expiresInSec)
      ? new Date(Date.now() + expiresInSec * 1000)
      : null;
  await prisma.pinterestCredentials.upsert({
    where: { id: SINGLETON_ID },
    create: {
      id: SINGLETON_ID,
      accessToken: encryptSecret(accessToken),
      refreshToken: refreshToken ? encryptSecret(refreshToken) : null,
      expiresAt,
    },
    update: {
      accessToken: encryptSecret(accessToken),
      refreshToken: refreshToken ? encryptSecret(refreshToken) : null,
      expiresAt,
    },
  });
}

export async function getPinterestAccessTokenFromDb(): Promise<string | null> {
  const row = await prisma.pinterestCredentials.findUnique({
    where: { id: SINGLETON_ID },
  });
  if (!row) return null;
  try {
    return decryptSecret(row.accessToken);
  } catch {
    return null;
  }
}

export async function clearPinterestCredentials(): Promise<void> {
  await prisma.pinterestCredentials.deleteMany({
    where: { id: SINGLETON_ID },
  });
}

