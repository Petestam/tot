import { prisma } from '@/lib/prisma';
import { decryptSecret, encryptSecret } from '@/lib/crypto-token';

const SINGLETON_ID = 'singleton';
const REFRESH_SKEW_MS = 5 * 60 * 1000;

type PinterestTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  message?: string;
};

function computeExpiresAt(expiresInSec?: number): Date | null {
  return expiresInSec && Number.isFinite(expiresInSec)
    ? new Date(Date.now() + expiresInSec * 1000)
    : null;
}

function pinterestBasicAuth(): string {
  const clientId = process.env.PINTEREST_APP_ID;
  const clientSecret = process.env.PINTEREST_APP_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('PINTEREST_APP_ID and PINTEREST_APP_SECRET must be set');
  }
  return Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
}

async function refreshPinterestAccessToken(refreshToken: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt: Date | null;
}> {
  const tokenRes = await fetch('https://api.pinterest.com/v5/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${pinterestBasicAuth()}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }).toString(),
  });

  const raw = await tokenRes.text();
  let data: PinterestTokenResponse = {};
  try {
    data = raw ? (JSON.parse(raw) as PinterestTokenResponse) : {};
  } catch {
    throw new Error('Pinterest token refresh returned invalid JSON');
  }

  if (!tokenRes.ok) {
    throw new Error(data.message || `Pinterest token refresh failed (${tokenRes.status})`);
  }

  if (!data.access_token) {
    throw new Error('Pinterest token refresh returned no access_token');
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? refreshToken,
    expiresAt: computeExpiresAt(data.expires_in),
  };
}

export async function savePinterestTokens(
  accessToken: string,
  refreshToken?: string | null,
  expiresInSec?: number
): Promise<void> {
  const expiresAt = computeExpiresAt(expiresInSec);
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

  let accessToken: string;
  try {
    accessToken = decryptSecret(row.accessToken);
  } catch {
    return null;
  }

  const shouldRefresh =
    !!row.refreshToken &&
    !!row.expiresAt &&
    row.expiresAt.getTime() <= Date.now() + REFRESH_SKEW_MS;

  if (!shouldRefresh) {
    return accessToken;
  }

  try {
    const refreshToken = decryptSecret(row.refreshToken!);
    const refreshed = await refreshPinterestAccessToken(refreshToken);
    await prisma.pinterestCredentials.update({
      where: { id: SINGLETON_ID },
      data: {
        accessToken: encryptSecret(refreshed.accessToken),
        refreshToken: encryptSecret(refreshed.refreshToken),
        expiresAt: refreshed.expiresAt,
      },
    });
    return refreshed.accessToken;
  } catch (error) {
    console.error('Pinterest token refresh failed:', error);
    return accessToken;
  }
}

export async function clearPinterestCredentials(): Promise<void> {
  await prisma.pinterestCredentials.deleteMany({
    where: { id: SINGLETON_ID },
  });
}

