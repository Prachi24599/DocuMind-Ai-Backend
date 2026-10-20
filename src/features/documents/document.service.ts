import { z } from 'zod';
import type { Document } from '../../generated/prisma/client';
import { getPrismaClient } from '../../database/client';

const uuidSchema = z.string().uuid();
const documentInputSchema = z.object({
  storageKey: z.string().refine((value) => value.trim().length > 0),
  filename: z.string().refine((value) => value.trim().length > 0),
  fileSizeBytes: z.union([
    z.bigint().positive(),
    z.number().int().positive().refine(Number.isSafeInteger),
  ]),
  mimeType: z.literal('application/pdf'),
  pageCount: z.number().int().positive().nullable().optional(),
});

export type CreateDocumentInput = z.infer<typeof documentInputSchema>;

export class DocumentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DocumentValidationError';
  }
}

export class DocumentNotFoundError extends Error {
  constructor() {
    super('Document not found.');
    this.name = 'DocumentNotFoundError';
  }
}

export class DocumentPersistenceError extends Error {
  constructor() {
    super('Unable to complete the document operation.');
    this.name = 'DocumentPersistenceError';
  }
}

const validateUuid = (value: string, label: string): string => {
  const result = uuidSchema.safeParse(value);
  if (!result.success) {
    throw new DocumentValidationError(`${label} must be a valid UUID.`);
  }

  return result.data;
};

export const createDocument = async (
  ownerId: string,
  input: CreateDocumentInput,
): Promise<Document> => {
  const validatedOwnerId = validateUuid(ownerId, 'Owner ID');
  const result = documentInputSchema.safeParse(input);
  if (!result.success) {
    throw new DocumentValidationError('Document metadata is invalid.');
  }

  try {
    return await getPrismaClient().document.create({
      data: { ...result.data, ownerId: validatedOwnerId },
    });
  } catch {
    throw new DocumentPersistenceError();
  }
};

export const listDocuments = async (ownerId: string): Promise<Document[]> => {
  const validatedOwnerId = validateUuid(ownerId, 'Owner ID');

  try {
    return await getPrismaClient().document.findMany({
      where: { ownerId: validatedOwnerId, deletedAt: null },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    });
  } catch {
    throw new DocumentPersistenceError();
  }
};

export const getDocument = async (id: string, ownerId: string): Promise<Document> => {
  const validatedId = validateUuid(id, 'Document ID');
  const validatedOwnerId = validateUuid(ownerId, 'Owner ID');

  let document: Document | null;
  try {
    document = await getPrismaClient().document.findUnique({
      where: {
        id_ownerId: { id: validatedId, ownerId: validatedOwnerId },
        deletedAt: null,
      },
    });
  } catch {
    throw new DocumentPersistenceError();
  }

  if (!document) {
    throw new DocumentNotFoundError();
  }

  return document;
};

export const softDeleteDocument = async (id: string, ownerId: string): Promise<void> => {
  const validatedId = validateUuid(id, 'Document ID');
  const validatedOwnerId = validateUuid(ownerId, 'Owner ID');

  let result: { count: number };
  try {
    result = await getPrismaClient().document.updateMany({
      where: { id: validatedId, ownerId: validatedOwnerId, deletedAt: null },
      data: { deletedAt: new Date(), storageKey: null },
    });
  } catch {
    throw new DocumentPersistenceError();
  }

  if (result.count === 0) {
    throw new DocumentNotFoundError();
  }
};