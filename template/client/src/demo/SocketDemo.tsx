import { useState } from 'react';
import { SOCKET_EVENTS } from '@appystack-template/shared';
import { useSocket } from '../hooks/useSocket.js';
import { cn } from '@/lib/utils.js';

interface PongResponse {
  message: string;
  timestamp: string;
}

export default function SocketDemo() {
  const { socket, connected } = useSocket();
  const [lastPong, setLastPong] = useState<PongResponse | null>(null);
  const [waiting, setWaiting] = useState(false);

  const sendPing = () => {
    if (!socket || !connected) return;

    setWaiting(true);

    socket.once(SOCKET_EVENTS.SERVER_PONG, (data) => {
      setLastPong(data);
      setWaiting(false);
    });

    socket.emit(SOCKET_EVENTS.CLIENT_PING);
  };

  return (
    <div className="rounded-xl p-5 bg-card-bg border border-card-border">
      <div className="flex items-center gap-2 mb-3">
        <span
          className={`inline-block w-3 h-3 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`}
        />
        <h3 className="text-lg font-semibold text-text-primary">Socket.io Demo</h3>
      </div>

      <div className="text-sm space-y-3 text-text-secondary">
        <p>Status: {connected ? 'connected' : 'disconnected'}</p>

        <button
          onClick={sendPing}
          disabled={!connected || waiting}
          className={cn(
            'px-4 py-2 rounded text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
            connected ? 'bg-terminal-green text-dark-bg' : 'bg-card-border text-text-secondary'
          )}
        >
          {waiting ? 'Waiting for pong...' : 'Send Ping'}
        </button>

        {lastPong && (
          <div className="mt-3 p-3 rounded text-sm bg-dark-bg border border-terminal-green">
            <p className="text-terminal-green">server:pong received — {lastPong.message}</p>
            <p className="mt-1 text-terminal-green-dim">
              {new Date(lastPong.timestamp).toLocaleTimeString()}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
