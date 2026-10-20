import type { RequestHandler } from 'express';
import { resolveUserByClerkId } from '../users/user.service';
import { uploadPdfAndCreateDocument } from './document-upload.service';

const toDocumentResponse = (document: Awaited<ReturnType<typeof uploadPdfAndCreateDocument>>) => {
  const { ownerId: _ownerId, storageKey: _storageKey, fileSizeBytes, ...publicDocument } = document;
  return { ...publicDocument, fileSizeBytes: fileSizeBytes.toString() };
};

export const uploadDocumentHandler: RequestHandler = (req, res, next) => {
  void (async () => {
    if (!req.file) {
      res.status(400).json({ status: 'error', message: 'A PDF file is required.' });
      return;
    }

    const clerkUserId = req.authenticatedClerkUserId;
    if (!clerkUserId) {
      res.status(401).json({ status: 'error', message: 'Unauthorized' });
      return;
    }

    const user = await resolveUserByClerkId(clerkUserId);
    const document = await uploadPdfAndCreateDocument(user.id, req.file);
    res.status(201).json(toDocumentResponse(document));
  })().catch(next);
};
