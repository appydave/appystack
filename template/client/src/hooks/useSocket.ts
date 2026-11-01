import { useCallback, useSyncExternalStore } from 'react';
import { getEntitySocket } from '@/lib/entitySocket.js';

/**
 * Socket.io connection hook — returns the shared entity socket singleton and its connected state.
 * Uses the same connection as useEntity so the app maintains a single WebSocket.
 * Never creates a new socket — always observes the singleton from entitySocket.ts.
 * @returns the socket and a connected boolean
 */
export function useSocket() {
  const socket = getEntitySocket();
  // Stable identity: a new subscribe function each render makes React unsubscribe and resubscribe.
  const subscribe = useCallback(
    (notify: () => void) => {
      socket.on('connect', notify);
      socket.on('disconnect', notify);

      return () => {
        socket.off('connect', notify);
        socket.off('disconnect', notify);
      };
    },
    [socket]
  );
  const connected = useSyncExternalStore(subscribe, () => socket.connected);

  return { socket, connected };
}
