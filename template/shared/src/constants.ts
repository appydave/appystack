export const ROUTES = {
  HEALTH: '/health',
  API_INFO: '/api/info',
} as const;

export const SOCKET_EVENTS = {
  CLIENT_PING: 'client:ping',
  SERVER_PONG: 'server:pong',
} as const;
