// TODO: Extend these interfaces for your project

export interface ApiResponse<T = unknown> {
  status: 'ok' | 'error';
  data?: T;
  error?: string;
  timestamp: string;
}

export interface HealthResponse {
  status: 'ok';
  timestamp: string;
}

export interface ServerInfo {
  nodeVersion: string;
  environment: string;
  port: number;
  clientUrl: string;
  uptime: number;
}

export interface SocketEvents {
  'client:ping': () => void;
  'server:message': (data: { message: string; timestamp: string }) => void;
}
