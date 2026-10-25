import type { Server } from 'socket.io';
import type { ServerToClientEvents, ClientToServerEvents } from '@appystack-template/shared';
import { SOCKET_EVENTS } from '@appystack-template/shared';
import { logger } from './config/logger.js';

export type AppServer = Server<ClientToServerEvents, ServerToClientEvents>;

/** The Socket.io event handlers. index.ts wires them to the real server; tests wire them to their own. */
export function registerSocketHandlers(io: AppServer): void {
  io.on('connection', (socket) => {
    // Auth pattern — uncomment and adapt for your app:
    // const token = socket.handshake.auth.token as string | undefined;
    // if (!token) { socket.disconnect(); return; }
    // try {
    //   const payload = verifyToken(token); // replace with your JWT verify function
    //   socket.data.userId = payload.sub;
    // } catch {
    //   socket.disconnect();
    //   return;
    // }
    logger.info({ socketId: socket.id }, 'Client connected');

    socket.on(SOCKET_EVENTS.CLIENT_PING, () => {
      socket.emit(SOCKET_EVENTS.SERVER_PONG, {
        message: 'pong',
        timestamp: new Date().toISOString(),
      });
    });

    socket.on('disconnect', () => {
      logger.info({ socketId: socket.id }, 'Client disconnected');
    });
  });
}
