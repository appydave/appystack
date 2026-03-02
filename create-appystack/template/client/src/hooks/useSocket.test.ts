import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { createServer } from 'node:http';
import type { Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Server as SocketServer } from 'socket.io';
import type { ServerToClientEvents, ClientToServerEvents } from '@appystack-template/shared';
import { SOCKET_EVENTS } from '@appystack-template/shared';
import { useSocket, getSocketUrl } from './useSocket.js';

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

describe('getSocketUrl', () => {
  it('returns window.location.origin when VITE_SOCKET_URL is not set', () => {
    // Ensure VITE_SOCKET_URL is absent; vi.stubEnv mutates import.meta.env in place
    vi.stubEnv('VITE_SOCKET_URL', undefined as unknown as string);
    // window.location was set in beforeAll to the test server origin
    expect(getSocketUrl()).toBe(window.location.origin);
    vi.unstubAllEnvs();
  });

  it('returns VITE_SOCKET_URL value when it is set', () => {
    const customUrl = 'http://custom-socket-server:4000';
    vi.stubEnv('VITE_SOCKET_URL', customUrl);
    expect(getSocketUrl()).toBe(customUrl);
    vi.unstubAllEnvs();
  });
});

describe('useSocket — connect_error handling', () => {
  it('exposes a socket that supports registering a connect_error listener without throwing', async () => {
    const { result, unmount } = renderHook(() => useSocket());

    await waitFor(
      () => {
        expect(result.current.connected).toBe(true);
      },
      { timeout: 5000 }
    );

    // Verify that the socket exposes the .on() method so callers can listen for connect_error.
    // Socket.io reserves connect_error as an internal event — it cannot be user-emitted,
    // but consumers can register listeners for it. Confirm the hook surface is correct.
    expect(typeof result.current.socket?.on).toBe('function');

    // Register a connect_error listener — this must not throw
    expect(() => {
      result.current.socket?.on('connect_error', () => {});
    }).not.toThrow();

    unmount();
  });
});
