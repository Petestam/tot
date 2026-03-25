import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  neonPool: Pool | undefined;
};

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }
  if (!connectionString.startsWith('postgres')) {
    throw new Error(
      'DATABASE_URL must be a PostgreSQL URL (Neon pooled connection or local Postgres). SQLite is not supported.'
    );
  }

  // Node runtimes (local `next dev`, Vercel Node) need a WebSocket implementation for Neon's pool.
  if (typeof globalThis.WebSocket === 'undefined') {
    neonConfig.webSocketConstructor = ws;
  }

  const pool = globalForPrisma.neonPool ?? new Pool({ connectionString });
  globalForPrisma.neonPool = pool;

  const adapter = new PrismaNeon(pool);

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });
}

export const prisma =
  globalForPrisma.prisma ?? (globalForPrisma.prisma = createPrismaClient());
