/**
 * What the server does when it cannot bind its port. It never kills whatever holds the port (that may
 * be an earlier instance mid-write, or another app): it says who to look for and exits, so
 * `concurrently --kill-others` stops the client too and the next start is clean.
 */
export function portInUseMessage(port: number): string {
  return `Port ${port} is already in use. Find the process with: lsof -i :${port}. Stop it, or set PORT in .env.`;
}

/** The listen 'error' handler: a port in use is a clear message and exit 1; anything else is rethrown. */
export function onListenError(port: number, exit: (code: number) => void = process.exit) {
  return (err: NodeJS.ErrnoException): void => {
    if (err.code !== 'EADDRINUSE') {
      throw err;
    }

    console.error(portInUseMessage(port));
    exit(1);
  };
}
