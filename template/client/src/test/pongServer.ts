import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Server } from 'socket.io';
import { SOCKET_EVENTS } from '@appystack-template/shared';

export interface PongServer {
  url: string;
  close: () => Promise<void>;
}

/**
 * A real Socket.io server on a random port that answers client:ping with server:pong, the contract the
 * client relies on. The client cannot import the server's own handlers (client never loads server code).
 */
export function startPongServer(): Promise<PongServer> {
  const httpServer = createServer();
  const io = new Server(httpServer, { cors: { origin: '*' } });

  io.on('connection', (socket) => {
    socket.on(SOCKET_EVENTS.CLIENT_PING, () => {
      socket.emit(SOCKET_EVENTS.SERVER_PONG, {
        message: 'pong',
        timestamp: new Date().toISOString(),
      });
    });
  });

  return new Promise((resolve) => {
    httpServer.listen(0, () => {
      const { port } = httpServer.address() as AddressInfo;

      resolve({
        url: `http://localhost:${port}`,
        close: () => new Promise((done) => io.close(() => done())),
      });
    });
  });
}
