import express from 'express';
import { createServer } from 'node:http';
import { join, dirname } from 'node:path'; // used for production static file serving below
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import helmet from 'helmet';
import compression from 'compression';
import cors from 'cors';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { requestLogger } from './middleware/requestLogger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { apiLimiter } from './middleware/rateLimiter.js';
import { onListenError } from './listenError.js';
import { registerSocketHandlers } from './socket.js';
import healthRouter from './routes/health.js';
import infoRouter from './routes/info.js';
import type { ServerToClientEvents, ClientToServerEvents } from '@appystack-template/shared';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const httpServer = createServer(app);

const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: env.CLIENT_URL,
    methods: ['GET', 'POST'],
  },
});

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors({ origin: env.CLIENT_URL }));
app.use(express.json());
app.use(requestLogger);

// Rate limiting — apply before all routes
app.use(apiLimiter);

// Routes
app.use(healthRouter);
app.use(infoRouter);

// Production static file serving — serve the built client app
if (env.isProduction) {
  const clientDist = join(__dirname, '../../client/dist');
  app.use(express.static(clientDist));

  // SPA fallback — serve index.html for all non-API routes
  app.get('*splat', (_req, res) => {
    res.sendFile(join(clientDist, 'index.html'));
  });
}

// 404 catch-all — must be after all routes (only reached in non-production for unknown API routes)
app.use((_req, res) => {
  res.status(404).json({
    status: 'error',
    error: 'Not found',
    timestamp: new Date().toISOString(),
  });
});

// Global error handler — must be last middleware (4 params)
app.use(errorHandler);

// Socket.io
registerSocketHandlers(io);

// Start server — skip in test environment to prevent EADDRINUSE when multiple
// test files import this module. Tests use supertest with app directly.
if (!env.isTest) {
  httpServer.on('error', onListenError(env.PORT));
  httpServer.listen(env.PORT, env.HOST, () => {
    logger.info(`Server running on http://localhost:${env.PORT} (bound to ${env.HOST})`);
    logger.info(`Client URL: ${env.CLIENT_URL}`);
  });
}

// Graceful shutdown
const shutdown = () => {
  logger.info('Shutting down gracefully...');
  io.close();
  httpServer.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

export { app, httpServer };
