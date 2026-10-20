import type { User } from '../../generated/prisma/client';
import { getPrismaClient } from '../../database/client';

export class UserResolutionError extends Error {
  readonly statusCode = 500;

  constructor() {
    super('Unable to resolve the authenticated user.');
    this.name = 'UserResolutionError';
  }
}

export const resolveUserByClerkId = async (clerkUserId: string): Promise<User> => {
  if (!clerkUserId.trim()) {
    throw new UserResolutionError();
  }

  try {
    return await getPrismaClient().user.upsert({
      where: { clerkUserId },
      create: { clerkUserId },
      update: { clerkUserId },
    });
  } catch {
    throw new UserResolutionError();
  }
};
