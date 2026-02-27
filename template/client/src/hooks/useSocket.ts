import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents } from '@appystack-template/shared';

/** Typed Socket.io client instance for the AppyStack template event contracts. */
export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

// Resolve the socket URL at connection time so test environments can set window.location first.
// Override via VITE_SOCKET_URL env var if a different server is needed.
export function getSocketUrl(): string {
  return (import.meta.env.VITE_SOCKET_URL as string | undefined) ?? window.location.origin;
}

/**
 * Socket.io connection hook for the AppyStack template.
 * @returns socket ref (null until connected) and connected boolean
 */
export function useSocket() {
  const socketRef = useRef<AppSocket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const socket: AppSocket = io(getSocketUrl(), {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5, // give up after 5 attempts; set to Infinity to retry forever
      reconnectionDelay: 1000, // initial delay before first reconnect attempt (ms)
      reconnectionDelayMax: 5000, // maximum delay between attempts (ms)
      randomizationFactor: 0.5, // jitter factor to avoid thundering herd (0 = no jitter)
    });
    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    return () => {
      socket.disconnect();
    };
  }, []);

  return { socket: socketRef.current, connected };
}
