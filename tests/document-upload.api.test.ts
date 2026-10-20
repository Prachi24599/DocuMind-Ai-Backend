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
}));
const storageMocks = vi.hoisted(() => ({
  upload: vi.fn(),
  remove: vi.fn(),
}));

vi.mock('@clerk/express', () => authMocks);
vi.mock('../src/config/env', () => ({
  config: {
    CLERK_PUBLISHABLE_KEY: 'pk_test_example',
    CLERK_SECRET_KEY: 'sk_test_example',
    CORS_ORIGIN: 'http://frontend.example',
    DATABASE_URL: 'postgresql://localhost/documind_test',
    R2_ACCOUNT_ID: 'account-example',
    R2_ACCESS_KEY_ID: 'access-example',
    R2_SECRET_ACCESS_KEY: 'secret-example',
    R2_BUCKET_NAME: 'documind-private',
    MAX_UPLOAD_SIZE_BYTES: 1024,
  },
}));
vi.mock('../src/database/client', () => ({
  getPrismaClient: () => ({
    user: { upsert: prismaMocks.userUpsert },
    document: { create: prismaMocks.create },
  }),
}));
vi.mock('../src/features/documents/object-storage', () => ({
  uploadPrivateObject: storageMocks.upload,
  removePrivateObject: storageMocks.remove,
}));

import app from '../src/app';

interface MockRequest extends Request {
  mockAuth?: { isAuthenticated: boolean; userId: string | null };
}

const ownerId = 'a4a34c18-8a94-4fae-a53f-2f49574985b7';
const otherOwnerId = '7e4891ab-cd4e-4321-b837-8ace29b57da0';
const pdfBuffer = Buffer.from('%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n');
const storedDocument = {
  id: 'f4218aad-2cc7-47e7-90b3-0d18bd0eb2f0',
  ownerId,
  storageKey: `documents/${ownerId}/random.pdf`,
  filename: 'portfolio.pdf',
  fileSizeBytes: BigInt(pdfBuffer.length),
  mimeType: 'application/pdf',
  pageCount: null,
  status: 'PENDING',
  createdAt: new Date('2026-10-20T12:00:00.000Z'),
  updatedAt: new Date('2026-10-20T12:00:00.000Z'),
  deletedAt: null,
};

const uploadRequest = (token = 'Bearer valid-session-token') =>
  request(app).post('/api/documents/upload').set('Authorization', token);

describe('private PDF upload API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMocks.userUpsert.mockImplementation(({ where }: { where: { clerkUserId: string } }) => ({
      id: where.clerkUserId === 'user_other_verified' ? otherOwnerId : ownerId,
      clerkUserId: where.clerkUserId,
    }));
    prismaMocks.create.mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
      ...storedDocument,
      ...data,
    }));
    storageMocks.upload.mockResolvedValue(undefined);
    storageMocks.remove.mockResolvedValue(undefined);
  });

  it('rejects missing and invalid credentials before storage or database access', async () => {
    const missing = await request(app).post('/api/documents/upload')
      .attach('file', pdfBuffer, { filename: 'sample.pdf', contentType: 'application/pdf' });
    const invalid = await uploadRequest('Bearer invalid-token')
      .attach('file', pdfBuffer, { filename: 'sample.pdf', contentType: 'application/pdf' });

    expect(missing.status).toBe(401);
    expect(invalid.status).toBe(401);
    expect(storageMocks.upload).not.toHaveBeenCalled();
    expect(prismaMocks.userUpsert).not.toHaveBeenCalled();
  });

  it('uploads a verified PDF to private storage before creating owned metadata', async () => {
    const response = await uploadRequest()
      .attach('file', pdfBuffer, { filename: 'portfolio.pdf', contentType: 'application/pdf' });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      id: storedDocument.id,
      filename: 'portfolio.pdf',
      fileSizeBytes: String(pdfBuffer.length),
      status: 'PENDING',
    });
    expect(response.body).not.toHaveProperty('ownerId');
    expect(response.body).not.toHaveProperty('storageKey');
    expect(response.body).not.toHaveProperty('url');

    const [key, uploadedBody, contentType] = storageMocks.upload.mock.calls[0] as [string, Buffer, string];
    expect(key).toMatch(new RegExp(`^documents/${ownerId}/[0-9a-f-]{36}\\.pdf$`));
    expect(uploadedBody).toEqual(pdfBuffer);
    expect(contentType).toBe('application/pdf');
    expect(prismaMocks.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ownerId,
        storageKey: key,
        filename: 'portfolio.pdf',
        fileSizeBytes: pdfBuffer.length,
        mimeType: 'application/pdf',
      }),
    });
    expect(storageMocks.upload.mock.invocationCallOrder[0])
      .toBeLessThan(prismaMocks.create.mock.invocationCallOrder[0]);
  });

  it('rejects missing file, invalid MIME type, and invalid PDF contents', async () => {
    const missing = await uploadRequest();
    const wrongMime = await uploadRequest()
      .attach('file', pdfBuffer, { filename: 'sample.txt', contentType: 'text/plain' });
    const badContent = await uploadRequest()
      .attach('file', Buffer.from('not really a PDF at all'), {
        filename: 'sample.pdf',
        contentType: 'application/pdf',
      });

    expect(missing.status).toBe(400);
    expect(wrongMime.status).toBe(415);
    expect(badContent.status).toBe(415);
    expect(storageMocks.upload).not.toHaveBeenCalled();
    expect(prismaMocks.create).not.toHaveBeenCalled();
  });

  it('enforces the configured upload size limit', async () => {
    const oversizePdf = Buffer.concat([
      Buffer.from('%PDF-1.7\n'),
      Buffer.alloc(1100, 65),
      Buffer.from('\n%%EOF'),
    ]);
    const response = await uploadRequest()
      .attach('file', oversizePdf, { filename: 'large.pdf', contentType: 'application/pdf' });

    expect(response.status).toBe(413);
    expect(response.body).toEqual({ status: 'error', message: 'Uploaded file is too large.' });
    expect(storageMocks.upload).not.toHaveBeenCalled();
  });

  it('rejects client-supplied ownership fields', async () => {
    const response = await uploadRequest()
      .field('ownerId', otherOwnerId)
      .attach('file', pdfBuffer, { filename: 'sample.pdf', contentType: 'application/pdf' });

    expect(response.status).toBe(400);
    expect(storageMocks.upload).not.toHaveBeenCalled();
    expect(prismaMocks.create).not.toHaveBeenCalled();
  });

  it('does not create metadata when storage upload fails', async () => {
    storageMocks.upload.mockRejectedValue(
      Object.assign(new Error('Unable to store the document.'), { statusCode: 502 }),
    );

    const response = await uploadRequest()
      .attach('file', pdfBuffer, { filename: 'sample.pdf', contentType: 'application/pdf' });

    expect(response.status).toBe(502);
    expect(response.body).toEqual({ status: 'error', message: 'Internal Server Error' });
    expect(prismaMocks.create).not.toHaveBeenCalled();
    expect(storageMocks.remove).not.toHaveBeenCalled();
  });

  it('removes the uploaded object if metadata creation fails', async () => {
    prismaMocks.create.mockRejectedValue(new Error('private database detail'));

    const response = await uploadRequest()
      .attach('file', pdfBuffer, { filename: 'sample.pdf', contentType: 'application/pdf' });

    const [key] = storageMocks.upload.mock.calls[0] as [string];
    expect(response.status).toBe(500);
    expect(response.body).toEqual({ status: 'error', message: 'Internal Server Error' });
    expect(storageMocks.remove).toHaveBeenCalledWith(key);
  });

  it('reports cleanup failure safely after metadata failure', async () => {
    prismaMocks.create.mockRejectedValue(new Error('private database detail'));
    storageMocks.remove.mockRejectedValue(new Error('private storage detail'));
    const logError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const response = await uploadRequest()
      .attach('file', pdfBuffer, { filename: 'sample.pdf', contentType: 'application/pdf' });

    expect(response.status).toBe(500);
    expect(response.body.message).toBe('Internal Server Error');
    expect(logError).toHaveBeenCalledWith(
      'Uploaded document cleanup failed after metadata creation failed.',
    );
    logError.mockRestore();
  });

  it('derives a separate internal owner UUID for a different verified Clerk user', async () => {
    const response = await uploadRequest('Bearer other-session-token')
      .attach('file', pdfBuffer, { filename: 'sample.pdf', contentType: 'application/pdf' });

    expect(response.status).toBe(201);
    expect(prismaMocks.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ ownerId: otherOwnerId }),
    });
    expect(storageMocks.upload.mock.calls[0]?.[0]).toMatch(
      new RegExp(`^documents/${otherOwnerId}/`),
    );
  });
});
