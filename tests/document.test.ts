import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Document } from '../src/generated/prisma/client';

const prismaMocks = vi.hoisted(() => ({
  create: vi.fn(),
  findMany: vi.fn(),
  findUnique: vi.fn(),
  updateMany: vi.fn(),
}));

vi.mock('../src/database/client', () => ({
  getPrismaClient: () => ({ document: prismaMocks }),
}));

import {
  createDocument,
  DocumentNotFoundError,
  DocumentPersistenceError,
  DocumentValidationError,
  getDocument,
  listDocuments,
  softDeleteDocument,
} from '../src/features/documents/document.service';

const ownerId = 'a4a34c18-8a94-4fae-a53f-2f49574985b7';
const anotherOwnerId = '7e4891ab-cd4e-4321-b837-8ace29b57da0';
const documentId = 'f4218aad-2cc7-47e7-90b3-0d18bd0eb2f0';

const documentRecord: Document = {
  id: documentId,
  ownerId,
  storageKey: 'documents/example.pdf',
  filename: 'example.pdf',
  fileSizeBytes: 128n,
  mimeType: 'application/pdf',
  pageCount: 2,
  status: 'PENDING',
  createdAt: new Date('2026-10-19T10:00:00.000Z'),
  updatedAt: new Date('2026-10-19T10:00:00.000Z'),
  deletedAt: null,
};

const validInput = {
  storageKey: 'documents/example.pdf',
  filename: 'example.pdf',
  fileSizeBytes: 128n,
  mimeType: 'application/pdf' as const,
  pageCount: 2,
};

describe('document metadata service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates metadata for the supplied owner', async () => {
    prismaMocks.create.mockResolvedValue(documentRecord);

    await expect(createDocument(ownerId, validInput)).resolves.toEqual(documentRecord);
    expect(prismaMocks.create).toHaveBeenCalledWith({
      data: { ...validInput, ownerId },
    });
  });

  it('lists active documents for the owner in deterministic creation order', async () => {
    prismaMocks.findMany.mockResolvedValue([documentRecord]);

    await expect(listDocuments(ownerId)).resolves.toEqual([documentRecord]);
    expect(prismaMocks.findMany).toHaveBeenCalledWith({
      where: { ownerId, deletedAt: null },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    });
  });

  it('retrieves a document using its compound ID and owner key', async () => {
    prismaMocks.findUnique.mockResolvedValue(documentRecord);

    await expect(getDocument(documentId, ownerId)).resolves.toEqual(documentRecord);
    expect(prismaMocks.findUnique).toHaveBeenCalledWith({
      where: { id_ownerId: { id: documentId, ownerId }, deletedAt: null },
    });
  });

  it('returns the same not-found outcome for another owner and an unknown document', async () => {
    prismaMocks.findUnique.mockResolvedValue(null);

    const wrongOwnerError = getDocument(documentId, anotherOwnerId);
    const unknownDocumentError = getDocument(documentId, ownerId);

    await expect(wrongOwnerError).rejects.toBeInstanceOf(DocumentNotFoundError);
    await expect(unknownDocumentError).rejects.toBeInstanceOf(DocumentNotFoundError);
    await expect(wrongOwnerError).rejects.toThrow('Document not found.');
    await expect(unknownDocumentError).rejects.toThrow('Document not found.');
  });

  it('soft-deletes only the active document owned by the caller', async () => {
    prismaMocks.updateMany.mockResolvedValue({ count: 1 });

    await expect(softDeleteDocument(documentId, ownerId)).resolves.toBeUndefined();

    const [query] = prismaMocks.updateMany.mock.calls[0] as [{ where: object; data: object }];
    expect(query.where).toEqual({ id: documentId, ownerId, deletedAt: null });
    expect(query.data).toMatchObject({ storageKey: null });
    expect(query.data).toHaveProperty('deletedAt', expect.any(Date));
  });

  it('returns not-found when no owned active document was deleted', async () => {
    prismaMocks.updateMany.mockResolvedValue({ count: 0 });

    await expect(softDeleteDocument(documentId, ownerId)).rejects.toBeInstanceOf(DocumentNotFoundError);
  });

  it('rejects invalid service inputs before querying Prisma', async () => {
    await expect(createDocument('not-a-uuid', validInput)).rejects.toBeInstanceOf(DocumentValidationError);
    await expect(createDocument(ownerId, { ...validInput, storageKey: '' })).rejects.toThrow(
      'Document metadata is invalid.',
    );
    expect(prismaMocks.create).not.toHaveBeenCalled();
  });

  it('hides database error details from callers', async () => {
    prismaMocks.create.mockRejectedValue(new Error('private database detail'));

    await expect(createDocument(ownerId, validInput)).rejects.toBeInstanceOf(DocumentPersistenceError);
    await expect(createDocument(ownerId, validInput)).rejects.not.toThrow('private database detail');
  });
});