import { Router } from 'express';
import type { ServerInfo } from '@appystack-template/shared';
import { env } from '../config/env.js';
import { apiSuccess } from '../helpers/response.js';

const router = Router();

router.get('/api/info', (_req, res) => {
  const data: ServerInfo = {
    nodeVersion: process.version,
    environment: env.NODE_ENV,
    port: env.PORT,
    clientUrl: env.CLIENT_URL,
    uptime: process.uptime(),
  };
  apiSuccess(res, data);
});

export default router;
