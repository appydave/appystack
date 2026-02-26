import { Router } from 'express';
import type { ApiResponse, ServerInfo } from '@appystack-template/shared';
import { env } from '../config/env.js';

const router = Router();

router.get('/api/info', (_req, res) => {
  const response: ApiResponse<ServerInfo> = {
    status: 'ok',
    data: {
      nodeVersion: process.version,
      environment: env.NODE_ENV,
      port: env.PORT,
      clientUrl: env.CLIENT_URL,
      uptime: process.uptime(),
    },
    timestamp: new Date().toISOString(),
  };
  res.json(response);
});

export default router;
