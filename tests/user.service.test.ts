import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMocks = vi.hoisted(() => ({
  upsert: vi.fn(),
}));

vi.mock('../src/database/client', () => ({
  getPrismaClient: () => ({ user: prismaMocks }),
}));

import { resolveUserByClerkId, UserResolutionError } from '../src/features/users/user.service';

const userRecord = {
  id: 'a4a34c18-8a94-4fae-a53f-2f49574985b7',
  clerkUserId: 'user_verified_123',
  createdAt: new Date('2026-10-20T12:00:00.000Z'),
  updatedAt: new Date('2026-10-20T12:00:00.000Z'),
};

describe('user resolution service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses a unique-key upsert to resolve concurrent first requests safely', async () => {
    prismaMocks.upsert.mockResolvedValue(userRecord);

    const users = await Promise.all([
      resolveUserByClerkId('user_verified_123'),
      resolveUserByClerkId('user_verified_123'),
    ]);

    expect(users).toEqual([userRecord, userRecord]);
    expect(prismaMocks.upsert).toHaveBeenCalledTimes(2);
    expect(prismaMocks.upsert).toHaveBeenCalledWith({
      where: { clerkUserId: 'user_verified_123' },
      create: { clerkUserId: 'user_verified_123' },
      update: { clerkUserId: 'user_verified_123' },
    });
  });

  it('does not accept an empty identity', async () => {
    await expect(resolveUserByClerkId(' ')).rejects.toBeInstanceOf(UserResolutionError);
    expect(prismaMocks.upsert).not.toHaveBeenCalled();
  });

  it('hides database failures behind a safe resolution error', async () => {
    prismaMocks.upsert.mockRejectedValue(new Error('private database details'));

    await expect(resolveUserByClerkId('user_verified_123')).rejects.toBeInstanceOf(UserResolutionError);
    await expect(resolveUserByClerkId('user_verified_123')).rejects.not.toThrow('private database details');
  });
});
