import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { config } from '../config/env';

let prismaClient: PrismaClient | undefined;

export const getPrismaClient = (): PrismaClient => {
  if (!config.DATABASE_URL) {
    throw new Error('Database access requires DATABASE_URL to be configured.');
  }

  if (!prismaClient) {
    const adapter = new PrismaPg({ connectionString: config.DATABASE_URL });
    prismaClient = new PrismaClient({ adapter });
  }

  return prismaClient;
};

export const disconnectDatabase = async (): Promise<void> => {
  if (!prismaClient) return;

  const client = prismaClient;
  prismaClient = undefined;
  await client.$disconnect();
};
