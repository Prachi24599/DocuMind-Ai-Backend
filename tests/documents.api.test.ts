import type { Request } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const authMocks = vi.hoisted(() => ({
  clerkMiddleware: vi.fn(() => (req: MockRequest, _res: unknown, next: (error?: Error) => void) => {
    const authorization = req.get('authorization');
    if (!authorization) {
      req.mockAuth = { isAuthenticated: false, userId: null };
      next();
      return;
    }

    if (authorization === 'Bearer other-session-token') {
      req.mockAuth = { isAuthenticated: true, userId: 'user_other_verified' };
      next();
      return;
    }

    if (authorization !== 'Bearer valid-session-token') {
      next(Object.assign(new Error('Invalid Clerk token.'), { reason: 'token-invalid' }));
      return;
    }

    req.mockAuth = { isAuthenticated: true, userId: 'user_verified_123' };
    next();
  }),
  getAuth: vi.fn((req: MockRequest) =>
    req.mockAuth ?? { isAuthenticated: false, userId: null }),
}));

const prismaMocks = vi.hoisted(() => ({
  userUpsert: vi.fn(),
  create: vi.fn(),
  findMany: vi.fn(),
  findUnique: vi.fn(),
  updateMany: vi.fn(),
}));

vi.mock('@clerk/express', () => authMocks);
vi.mock('../src/config/env', () => ({
  config: {
    CLERK_PUBLISHABLE_KEY: 'pk_test_example',
    CLERK_SECRET_KEY: 'sk_test_example',
    CORS_ORIGIN: 'http://frontend.example',
    DATABASE_URL: 'postgresql://localhost/documind_test',
  },
}));
vi.mock('../src/database/client', () => ({
  getPrismaClient: () => ({
    user: { upsert: prismaMocks.userUpsert },
    document: {
      create: prismaMocks.create,
      findMany: prismaMocks.findMany,
      findUnique: prismaMocks.findUnique,
      updateMany: prismaMocks.updateMany,
    },
  }),
}));

import app from '../src/app';

interface MockRequest extends Request {
  mockAuth?: { isAuthenticated: boolean; userId: string | null };
}

const ownerId = 'a4a34c18-8a94-4fae-a53f-2f49574985b7';
const anotherOwnerId = '7e4891ab-cd4e-4321-b837-8ace29b57da0';
const documentId = 'f4218aad-2cc7-47e7-90b3-0d18bd0eb2f0';
const documentRecord = {
  id: documentId,
  ownerId,
  storageKey: 'private/example.pdf',
  filename: 'example.pdf',
  fileSizeBytes: 128n,
  mimeType: 'application/pdf',
  pageCount: 2,
  status: 'PENDING',
  createdAt: new Date('2026-10-20T12:00:00.000Z'),
  updatedAt: new Date('2026-10-20T12:00:00.000Z'),
  deletedAt: null,
};

const authorized = (call: request.Test): request.Test =>
  call.set('Authorization', 'Bearer valid-session-token');

describe('authenticated document API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMocks.userUpsert.mockImplementation(({ where }: { where: { clerkUserId: string } }) =>
      where.clerkUserId === 'user_verified_123'
        ? { id: ownerId, clerkUserId: where.clerkUserId }
        : { id: anotherOwnerId, clerkUserId: where.clerkUserId });
    prismaMocks.create.mockResolvedValue(documentRecord);
    prismaMocks.findMany.mockResolvedValue([documentRecord]);
    prismaMocks.findUnique.mockResolvedValue(documentRecord);
    prismaMocks.updateMany.mockResolvedValue({ count: 1 });
  });

  it('rejects requests without valid credentials', async () => {
    const missing = await request(app).get('/api/documents');
    const invalid = await request(app).get('/api/documents')
      .set('Authorization', 'Bearer invalid-session-token');

    expect(missing.status).toBe(401);
    expect(invalid.status).toBe(401);
    expect(prismaMocks.userUpsert).not.toHaveBeenCalled();
  });

  it('does not expose a metadata-only document creation route', async () => {
    const response = await authorized(request(app).post('/api/documents')
      .send({
        storageKey: 'private/example.pdf',
        filename: 'example.pdf',
        fileSizeBytes: 128,
        mimeType: 'application/pdf',
        ownerId: '00000000-0000-0000-0000-000000000001',
      }));

    expect(response.status).toBe(404);
    expect(prismaMocks.create).not.toHaveBeenCalled();
  });

  it('lists the authenticated user active documents only', async () => {
    const response = await authorized(request(app).get('/api/documents?ownerId=00000000-0000-0000-0000-000000000001'));

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0]).not.toHaveProperty('ownerId');
    expect(prismaMocks.findMany).toHaveBeenCalledWith({
      where: { ownerId, deletedAt: null },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    });
  });

  it('retrieves a document by a valid UUID and rejects malformed route IDs', async () => {
    const retrieved = await authorized(request(app).get(`/api/documents/${documentId}`));
    const malformed = await authorized(request(app).get('/api/documents/not-a-uuid'));

    expect(retrieved.status).toBe(200);
    expect(malformed.status).toBe(400);
    expect(prismaMocks.findUnique).toHaveBeenCalledWith({
      where: { id_ownerId: { id: documentId, ownerId }, deletedAt: null },
    });
  });

  it('returns indistinguishable not-found responses for unknown and other users documents', async () => {
    prismaMocks.findUnique.mockImplementation(({ where }: { where: { id_ownerId: { id: string; ownerId: string } } }) =>
      where.id_ownerId.id === documentId && where.id_ownerId.ownerId === ownerId
        ? documentRecord
        : null);

    const unknown = await authorized(request(app).get('/api/documents/00000000-0000-0000-0000-000000000001'));
    const anotherUsers = await request(app).get(`/api/documents/${documentId}`)
      .set('Authorization', 'Bearer other-session-token');

    expect(unknown.status).toBe(404);
    expect(anotherUsers.status).toBe(404);
    expect(anotherUsers.body).toEqual(unknown.body);
    expect(prismaMocks.findUnique).toHaveBeenNthCalledWith(1, {
      where: {
        id_ownerId: {
          id: '00000000-0000-0000-0000-000000000001',
          ownerId,
        },
        deletedAt: null,
      },
    });
    expect(prismaMocks.findUnique).toHaveBeenNthCalledWith(2, {
      where: { id_ownerId: { id: documentId, ownerId: anotherOwnerId }, deletedAt: null },
    });
  });

  it('soft-deletes only the authenticated user document', async () => {
    const response = await authorized(request(app).delete(`/api/documents/${documentId}`));

    expect(response.status).toBe(204);
    expect(prismaMocks.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: documentId, ownerId, deletedAt: null },
    }));
  });
});
