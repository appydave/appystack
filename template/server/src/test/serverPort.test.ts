import { createServer } from 'node:http';
import { connect } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { serverPort } from './serverPort.js';

describe('serverPort', () => {
  const servers: ReturnType<typeof createServer>[] = [];

  afterEach(async () => {
    await Promise.all(
      servers.splice(0).map((s) => new Promise((done) => (s.listening ? s.close(done) : done(0))))
    );
  });

  function listening(listen: (s: ReturnType<typeof createServer>, ready: () => void) => void) {
    const server = createServer();

    servers.push(server);

    return new Promise<ReturnType<typeof createServer>>((resolve) =>
      listen(server, () => resolve(server))
    );
  }

  it('returns the port the server is bound to', async () => {
    const server = await listening((s, ready) => s.listen(0, ready));
    const port = serverPort(server);

    expect(port).toBeGreaterThan(0);

    await new Promise<void>((resolve, reject) => {
      const socket = connect(port, '127.0.0.1');

      socket.once('connect', () => {
        socket.end();
        resolve();
      });
      socket.once('error', reject);
    });
  });

  it('throws when the server is not listening', () => {
    expect(() => serverPort(createServer())).toThrow('not listening on a TCP port');
  });

  it('throws when the server listens on a pipe, not a TCP port', async () => {
    const path = join(tmpdir(), `appystack-serverport-${process.pid}.sock`);
    const server = await listening((s, ready) => s.listen(path, ready));

    expect(() => serverPort(server)).toThrow('not listening on a TCP port');
  });
});
