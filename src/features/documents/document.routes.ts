import { Router } from 'express';
import { requireAuthenticatedUser } from '../../middleware/clerk-auth';
import {
  deleteDocumentHandler,
  getDocumentHandler,
  listDocumentsHandler,
} from './document.controller';
import { uploadDocumentHandler } from './document-upload.controller';
import { requireObjectStorageConfiguration, uploadPdf } from './upload.middleware';

const router = Router();

router.use(requireAuthenticatedUser);
router.post('/upload', requireObjectStorageConfiguration, uploadPdf, uploadDocumentHandler);
router.get('/', listDocumentsHandler);
router.get('/:id', getDocumentHandler);
router.delete('/:id', deleteDocumentHandler);

export default router;
