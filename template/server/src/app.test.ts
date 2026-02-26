import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';
import type { AddressInfo } from 'node:net';
import { io as ioc } from 'socket.io-client';
import { SOCKET_EVENTS } from '@appystack-template/shared';
import { app, httpServer } from './index.js';

describe('Express app (via index.ts export)', () => {
  it('GET /health returns 200', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('GET /api/info returns 200', async () => {
    const res = await request(app).get('/api/info');
    expect(res.status).toBe(200);
  });

  it('GET /unknown-route returns 404', async () => {
    const res = await request(app).get('/unknown-route-that-does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.status).toBe('error');
    expect(res.body.error).toBe('Not found');
  });
});

describe('Socket.io via httpServer export', () => {
  let port: number;

  afterAll(() => {
    // nothing to tear down — httpServer is managed by the module
  });

  it('connects and receives server:pong after client:ping', () => {
    return new Promise<void>((resolve, reject) => {
      // Use the already-listening httpServer (started by index.ts)
      const addr = httpServer.address() as AddressInfo | null;
      port = addr ? addr.port : 5501;
      const url = `http://localhost:${port}`;

      const client = ioc(url, { forceNew: true, transports: ['websocket'] });

      client.on('connect_error', (err) => {
        client.disconnect();
        reject(err);
      });

      client.on('connect', () => {
        client.on(SOCKET_EVENTS.SERVER_PONG, (data) => {
          try {
            expect(data.message).toBe('pong');
            expect(typeof data.timestamp).toBe('string');
            client.disconnect();
            resolve();
          } catch (err) {
            client.disconnect();
            reject(err);
          }
        });
        client.emit(SOCKET_EVENTS.CLIENT_PING);
      });
    });
  });

  it('can connect and disconnect cleanly', () => {
    return new Promise<void>((resolve, reject) => {
      const addr = httpServer.address() as AddressInfo | null;
      const url = `http://localhost:${addr ? addr.port : 5501}`;

      const client = ioc(url, { forceNew: true, transports: ['websocket'] });

      client.on('connect_error', (err) => {
        client.disconnect();
        reject(err);
      });

      client.on('connect', () => {
        expect(client.connected).toBe(true);
        client.disconnect();
      });

      client.on('disconnect', (reason) => {
        try {
          expect(client.connected).toBe(false);
          expect(reason).toBe('io client disconnect');
          resolve();
        } catch (err) {
          reject(err);
        }
      });
    });
  });
});
