import { Router } from 'express';
import { healthCheck } from './health.controller';

const router = Router();

router.get('/api/health', healthCheck);

export default router;