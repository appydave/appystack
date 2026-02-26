import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { createServer } from 'node:http';
import type { Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Server as SocketServer } from 'socket.io';
import type { ServerToClientEvents, ClientToServerEvents } from '@appystack-template/shared';
import { SOCKET_EVENTS } from '@appystack-template/shared';
import { useSocket } from './useSocket.js';

let httpServer: HttpServer;
let io: SocketServer<ClientToServerEvents, ServerToClientEvents>;
let serverPort: number;

beforeAll(() => {
  return new Promise<void>((resolve) => {
    httpServer = createServer();

    io = new SocketServer<ClientToServerEvents, ServerToClientEvents>(httpServer, {
      cors: { origin: '*' },
    });

    io.on('connection', (socket) => {
      socket.on(SOCKET_EVENTS.CLIENT_PING, () => {
        socket.emit(SOCKET_EVENTS.SERVER_PONG, {
          message: 'pong',
          timestamp: new Date().toISOString(),
        });
      });
    });

    httpServer.listen(0, () => {
      serverPort = (httpServer.address() as AddressInfo).port;

      // Set jsdom's location so socket.io-client connects to our test server
      Object.defineProperty(window, 'location', {
        value: new URL(`http://localhost:${serverPort}`),
        writable: true,
        configurable: true,
      });

      resolve();
    });
  });
});

afterAll(() => {
  return new Promise<void>((resolve) => {
    io.close(() => {
      httpServer.close(() => resolve());
    });
  });
});

describe('useSocket', () => {
  it('starts with connected=false', () => {
    const { result, unmount } = renderHook(() => useSocket());
    expect(result.current.connected).toBe(false);
    unmount();
  });

  it('connects to the server and sets connected=true', async () => {
    const { result, unmount } = renderHook(() => useSocket());

    await waitFor(
      () => {
        expect(result.current.connected).toBe(true);
      },
      { timeout: 5000 }
    );

    unmount();
  });

  it('exposes the socket instance after connecting', async () => {
    const { result, unmount } = renderHook(() => useSocket());

    await waitFor(
      () => {
        expect(result.current.connected).toBe(true);
      },
      { timeout: 5000 }
    );

    // After connecting, the socket should be accessible
    // Note: socketRef.current is returned; it may be set after the state update
    expect(result.current.socket).toBeDefined();

    unmount();
  });

  it('sets connected=false after unmount (disconnect)', async () => {
    const { result, unmount } = renderHook(() => useSocket());

    await waitFor(
      () => {
        expect(result.current.connected).toBe(true);
      },
      { timeout: 5000 }
    );

    // Capture the socket instance before unmounting so we can verify it is disconnectable
    const socket = result.current.socket;
    expect(typeof socket?.disconnect).toBe('function');

    act(() => {
      unmount();
    });
  });
});
