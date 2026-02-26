import { useEffect, useState } from 'react';
import type { HealthResponse, ServerInfo } from '@appystack-template/shared';

interface ServerStatus {
  health: HealthResponse | null;
  info: ServerInfo | null;
  loading: boolean;
  error: string | null;
}

export function useServerStatus() {
  const [status, setStatus] = useState<ServerStatus>({
    health: null,
    info: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    async function fetchStatus() {
      try {
        const [healthRes, infoRes] = await Promise.all([fetch('/health'), fetch('/api/info')]);

        if (!healthRes.ok || !infoRes.ok) {
          throw new Error('Server returned an error');
        }

        const health: HealthResponse = await healthRes.json();
        const infoBody = await infoRes.json();

        setStatus({
          health,
          info: infoBody.data,
          loading: false,
          error: null,
        });
      } catch (err) {
        setStatus((prev) => ({
          ...prev,
          loading: false,
          error: err instanceof Error ? err.message : 'Failed to connect to server',
        }));
      }
    }

    fetchStatus();
  }, []);

  return status;
}
