import type { ServerInfo } from '@appystack-template/shared';
import { useServerStatus } from '@hooks/useServerStatus.js';
import { useSocket } from '@hooks/useSocket.js';

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span className={`inline-block w-3 h-3 rounded-full ${ok ? 'bg-green-500' : 'bg-red-500'}`} />
  );
}

function StatusCard({
  title,
  ok,
  children,
}: {
  title: string;
  ok: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl p-5 bg-card border border-border">
      <div className="flex items-center gap-2 mb-3">
        <StatusDot ok={ok} />
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      </div>
      <div className="text-sm text-muted-foreground">{children}</div>
    </div>
  );
}

function InfoCard({
  title,
  info,
  error,
  children,
}: {
  title: string;
  info: ServerInfo | null;
  error: string | null;
  children: (info: ServerInfo) => React.ReactNode;
}) {
  return (
    <StatusCard title={title} ok={!!info}>
      {info ? children(info) : <p className="text-red-400">{error || 'No data'}</p>}
    </StatusCard>
  );
}

export default function StatusGrid() {
  const { health, info, loading, error } = useServerStatus();
  const { connected } = useSocket();

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Connecting to server...</div>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-testid="status-grid">
      <StatusCard title="API Health" ok={!!health}>
        {health ? (
          <>
            <p>Status: {health.status}</p>
          </>
        ) : (
          <p className="text-red-400">{error || 'Unable to reach server'}</p>
        )}
      </StatusCard>

      <StatusCard title="WebSocket" ok={connected}>
        <p>Status: {connected ? 'connected' : 'disconnected'}</p>
      </StatusCard>

      <InfoCard title="Environment" info={info} error={error}>
        {(i) => (
          <>
            <p>Mode: {i.environment}</p>
            <p>Port: {i.port}</p>
          </>
        )}
      </InfoCard>

      <InfoCard title="Runtime" info={info} error={error}>
        {(i) => (
          <>
            <p>Node: {i.nodeVersion}</p>
            <p>Uptime: {Math.floor(i.uptime)}s</p>
          </>
        )}
      </InfoCard>
    </div>
  );
}
