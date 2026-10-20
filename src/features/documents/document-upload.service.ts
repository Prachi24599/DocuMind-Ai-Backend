import { randomUUID } from 'node:crypto';
import { basename } from 'node:path';
import type { Document } from '../../generated/prisma/client';
import { createDocument, type CreateDocumentInput } from './document.service';
import { removePrivateObject, uploadPrivateObject } from './object-storage';

export class InvalidPdfUploadError extends Error {
  readonly statusCode = 415;

  constructor() {
    super('Upload must be a valid PDF file.');
    this.name = 'InvalidPdfUploadError';
  }
}

export class MissingUploadError extends Error {
  readonly statusCode = 400;

  constructor() {
    super('A PDF file is required.');
    this.name = 'MissingUploadError';
  }
}

const hasPdfSignatureAndEndMarker = (buffer: Buffer): boolean => {
  if (buffer.length < 10 || buffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
    return false;
  }

  const trailer = buffer.subarray(Math.max(0, buffer.length - 1024));
  const content = buffer.toString('latin1');
  return trailer.includes(Buffer.from('%%EOF')) && /\/Type\s*\/Catalog\b/.test(content);
};

const normalizedFilename = (filename: string): string => {
  const safeName = basename(filename.replace(/\\/g, '/')).replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return safeName || 'document.pdf';
};

export const uploadPdfAndCreateDocument = async (
  ownerId: string,
  file: Express.Multer.File | undefined,
): Promise<Document> => {
  if (!file) throw new MissingUploadError();
  if (file.mimetype !== 'application/pdf' || !hasPdfSignatureAndEndMarker(file.buffer)) {
    throw new InvalidPdfUploadError();
  }

  const storageKey = `documents/${ownerId}/${randomUUID()}.pdf`;
  await uploadPrivateObject(storageKey, file.buffer, 'application/pdf');

  const input: CreateDocumentInput = {
    storageKey,
    filename: normalizedFilename(file.originalname),
    fileSizeBytes: file.size,
    mimeType: 'application/pdf',
  };

  try {
    return await createDocument(ownerId, input);
  } catch (error) {
    try {
      await removePrivateObject(storageKey);
    } catch {
      console.error('Uploaded document cleanup failed after metadata creation failed.');
    }
    throw error;
  }
};
