import { Router } from 'express';
import { requireAuthenticatedUser } from '../../middleware/clerk-auth';
import {
  createDocumentHandler,
  deleteDocumentHandler,
  getDocumentHandler,
  listDocumentsHandler,
} from './document.controller';

const router = Router();

router.use(requireAuthenticatedUser);
router.post('/', createDocumentHandler);
router.get('/', listDocumentsHandler);
router.get('/:id', getDocumentHandler);
router.delete('/:id', deleteDocumentHandler);

export default router;
