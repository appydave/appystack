import type { Server } from 'node:http';

/** The TCP port a listening test server is bound to. Throws instead of casting when it is not. */
export function serverPort(server: Server): number {
  const address = server.address();

  if (address === null || typeof address === 'string') {
    throw new Error('Test server is not listening on a TCP port');
  }

  return address.port;
}
