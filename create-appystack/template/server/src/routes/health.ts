import { Router } from 'express';
import type { HealthResponse } from '@appystack-template/shared';
import { apiSuccess } from '../helpers/response.js';

const router = Router();

router.get('/health', (_req, res) => {
  const data: HealthResponse = { status: 'ok' };
  apiSuccess(res, data);
});

export default router;
