// TODO: Extend these interfaces for your project

/** Response wrapper for all API endpoints. */
export interface ApiResponse<T = unknown> {
  status: 'ok' | 'error';
  data?: T;
  error?: string;
  timestamp: string;
}

/** Response shape for the /health endpoint. */
export interface HealthResponse {
  status: 'ok';
  timestamp: string;
}

/** Server metadata returned by the /api/info endpoint. */
export interface ServerInfo {
  nodeVersion: string;
  environment: string;
  port: number;
  clientUrl: string;
  uptime: number;
}

/** Socket.io events emitted from server to client. */
export interface ServerToClientEvents {
  'server:pong': (data: { message: string; timestamp: string }) => void;
}

/** Socket.io events emitted from client to server. */
export interface ClientToServerEvents {
  'client:ping': () => void;
}
