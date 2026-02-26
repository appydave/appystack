import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import helmet from 'helmet';
import compression from 'compression';
import cors from 'cors';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { requestLogger } from './middleware/requestLogger.js';
import { errorHandler } from './middleware/errorHandler.js';
import healthRouter from './routes/health.js';
import infoRouter from './routes/info.js';

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
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

// Routes
app.use(healthRouter);
app.use(infoRouter);

// 404 catch-all — must be after all routes
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
io.on('connection', (socket) => {
  logger.info({ socketId: socket.id }, 'Client connected');

  socket.on('client:ping', () => {
    socket.emit('server:pong', {
      message: 'pong',
      timestamp: new Date().toISOString(),
    });
  });

  socket.on('disconnect', () => {
    logger.info({ socketId: socket.id }, 'Client disconnected');
  });
});

// Start server
httpServer.listen(env.PORT, () => {
  logger.info(`Server running on http://localhost:${env.PORT}`);
  logger.info(`Client URL: ${env.CLIENT_URL}`);
});

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
