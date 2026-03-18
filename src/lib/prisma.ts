import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pool: pg.Pool | undefined;
};

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  const pool = new pg.Pool({ connectionString });
  const adapter = new PrismaPg(pool);

  return {
    pool,
    prisma: new PrismaClient({
      adapter,
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    }),
  };
}

const prismaResources = globalForPrisma.prisma && globalForPrisma.pool
  ? {
      prisma: globalForPrisma.prisma,
      pool: globalForPrisma.pool,
    }
  : createPrismaClient();

export const prisma = prismaResources.prisma;
const pool = prismaResources.pool;

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
  globalForPrisma.pool = pool;
}

export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
  await pool.end();

  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = undefined;
    globalForPrisma.pool = undefined;
  }
}
