import multer from 'multer';
import type { RequestHandler } from 'express';
import { config } from '../../config/env';

export const requireObjectStorageConfiguration: RequestHandler = (_req, res, next) => {
  const configured = Boolean(
    config.R2_ACCOUNT_ID
    && config.R2_ACCESS_KEY_ID
    && config.R2_SECRET_ACCESS_KEY
    && config.R2_BUCKET_NAME,
  );
  if (!configured) {
    res.status(503).json({ status: 'error', message: 'Document storage is not configured.' });
    return;
  }

  next();
};

export const uploadPdf = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.MAX_UPLOAD_SIZE_BYTES,
    files: 1,
    fields: 0,
    parts: 1,
  },
}).single('file');
