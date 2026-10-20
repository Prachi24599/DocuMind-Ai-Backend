import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { z } from 'zod';
import {
  createDocument,
  getDocument,
  listDocuments,
  softDeleteDocument,
} from './document.service';
import { resolveUserByClerkId } from '../users/user.service';

const uuidSchema = z.string().uuid();
const createDocumentSchema = z.object({
  storageKey: z.string().trim().min(1),
  filename: z.string().trim().min(1),
  fileSizeBytes: z.number().int().positive().refine(Number.isSafeInteger),
  mimeType: z.literal('application/pdf'),
  pageCount: z.number().int().positive().nullable().optional(),
}).strict();

const sendInvalidInput = (res: Response): void => {
  res.status(400).json({ status: 'error', message: 'Invalid request.' });
};

const sendError = (error: unknown, next: NextFunction): void => {
  next(error);
};

const handleAsync = (handler: RequestHandler): RequestHandler => (req, res, next) => {
  void Promise.resolve(handler(req, res, next)).catch(next);
};

const getOwnerId = async (req: Request): Promise<string> => {
  const clerkUserId = req.authenticatedClerkUserId;
  if (!clerkUserId) {
    const error = new Error('Unauthorized');
    Object.assign(error, { statusCode: 401 });
    throw error;
  }

  const user = await resolveUserByClerkId(clerkUserId);
  return user.id;
};

const toDocumentResponse = (document: Awaited<ReturnType<typeof getDocument>>) => {
  const { ownerId: _ownerId, fileSizeBytes, ...publicDocument } = document;
  return { ...publicDocument, fileSizeBytes: fileSizeBytes.toString() };
};

export const createDocumentHandler: RequestHandler = handleAsync(async (req, res, next) => {
  const input = createDocumentSchema.safeParse(req.body);
  if (!input.success) {
    sendInvalidInput(res);
    return;
  }

  try {
    const ownerId = await getOwnerId(req);
    const document = await createDocument(ownerId, input.data);
    res.status(201).json(toDocumentResponse(document));
  } catch (error) {
    sendError(error, next);
  }
});

export const listDocumentsHandler: RequestHandler = handleAsync(async (req, res, next) => {
  try {
    const ownerId = await getOwnerId(req);
    const documents = await listDocuments(ownerId);
    res.status(200).json(documents.map(toDocumentResponse));
  } catch (error) {
    sendError(error, next);
  }
});

const getValidatedDocumentId = (req: Request, res: Response): string | undefined => {
  const result = uuidSchema.safeParse(req.params.id);
  if (!result.success) {
    sendInvalidInput(res);
    return undefined;
  }

  return result.data;
};

export const getDocumentHandler: RequestHandler = handleAsync(async (req, res, next) => {
  const id = getValidatedDocumentId(req, res);
  if (!id) return;

  try {
    const ownerId = await getOwnerId(req);
    const document = await getDocument(id, ownerId);
    res.status(200).json(toDocumentResponse(document));
  } catch (error) {
    sendError(error, next);
  }
});

export const deleteDocumentHandler: RequestHandler = handleAsync(async (req, res, next) => {
  const id = getValidatedDocumentId(req, res);
  if (!id) return;

  try {
    const ownerId = await getOwnerId(req);
    await softDeleteDocument(id, ownerId);
    res.status(204).end();
  } catch (error) {
    sendError(error, next);
  }
});
