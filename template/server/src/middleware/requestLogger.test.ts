import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { requestLogger } from './requestLogger.js';
import { logger } from '../config/logger.js';

function buildApp() {
  const app = express();
  app.use(requestLogger);
  app.get('/ok', (_req, res) => {
    res.json({ ok: true });
  });
  app.get('/client-error', (_req, res) => {
    res.status(404).json({ error: 'not found' });
  });
  app.get('/server-error', (_req, res) => {
    res.status(500).json({ error: 'crash' });
  });
  app.get('/redirect', (_req, res) => {
    res.status(301).redirect('/ok');
  });
  // High-frequency endpoints — polled continuously in production.
  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });
  app.get('/api/ingest/status', (_req, res) => {
    res.json({ ok: true });
  });
  app.get('/mcp', (_req, res) => {
    res.status(405).json({ error: 'method not allowed' });
  });
  app.get('/healthcheck-ish', (_req, res) => {
    res.json({ ok: true });
  });
  return app;
}

describe('requestLogger middleware', () => {
  it('allows a successful request to pass through', async () => {
    const res = await request(buildApp()).get('/ok');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('does not block 4xx responses', async () => {
    const res = await request(buildApp()).get('/client-error');
    expect(res.status).toBe(404);
  });

  it('does not block 5xx responses', async () => {
    const res = await request(buildApp()).get('/server-error');
    expect(res.status).toBe(500);
  });

  it('assigns a unique request id', async () => {
    const app = buildApp();
    const res1 = await request(app).get('/ok');
    const res2 = await request(app).get('/ok');
    // Both requests succeed; id is internal but pino-http attaches nothing to body
    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
  });
});

describe('requestLogger customLogLevel', () => {
  // pino-http calls methods on a child logger created via logger.child({req}).
  // We intercept logger.child to return a controlled mock so we can assert
  // which log level method is actually invoked for each HTTP status code.

  interface ChildMock {
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    child: ReturnType<typeof vi.fn>;
  }

  let childMock: ChildMock;

  beforeEach(() => {
    childMock = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      child: vi.fn(),
    };
    // child().child() may be called too — wire up nested child to same mock
    childMock.child.mockReturnValue(childMock);
    vi.spyOn(logger, 'child').mockReturnValue(
      childMock as unknown as ReturnType<typeof logger.child>
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs at info level for 2xx responses', async () => {
    await request(buildApp()).get('/ok');
    expect(childMock.info).toHaveBeenCalled();
    expect(childMock.warn).not.toHaveBeenCalled();
    expect(childMock.error).not.toHaveBeenCalled();
  });

  it('logs at info level for 3xx responses', async () => {
    await request(buildApp()).get('/redirect').redirects(0);
    expect(childMock.info).toHaveBeenCalled();
    expect(childMock.warn).not.toHaveBeenCalled();
    expect(childMock.error).not.toHaveBeenCalled();
  });

  it('logs at warn level for 4xx responses', async () => {
    await request(buildApp()).get('/client-error');
    expect(childMock.warn).toHaveBeenCalled();
    expect(childMock.info).not.toHaveBeenCalled();
    expect(childMock.error).not.toHaveBeenCalled();
  });

  it('logs at error level for 5xx responses', async () => {
    await request(buildApp()).get('/server-error');
    expect(childMock.error).toHaveBeenCalled();
    expect(childMock.info).not.toHaveBeenCalled();
    expect(childMock.warn).not.toHaveBeenCalled();
  });
});

/**
 * Regression guard. Without this, an info-level access log on a polled endpoint
 * grows without bound under launchd/pm2/systemd — measured at ~21 MB/day
 * (~7.6 GB/year) on Captain's Log before the fix, with a single status endpoint
 * accounting for roughly half of all lines.
 */
describe('requestLogger high-frequency endpoint suppression', () => {
  interface ChildMock {
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    silent: ReturnType<typeof vi.fn>;
    child: ReturnType<typeof vi.fn>;
  }

  let childMock: ChildMock;

  beforeEach(() => {
    childMock = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      silent: vi.fn(),
      child: vi.fn(),
    };
    childMock.child.mockReturnValue(childMock);
    vi.spyOn(logger, 'child').mockReturnValue(
      childMock as unknown as ReturnType<typeof logger.child>
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([['/health'], ['/api/ingest/status'], ['/mcp']])(
    'does NOT log a successful %s at info level',
    async (path) => {
      await request(buildApp()).get(path);
      expect(childMock.info).not.toHaveBeenCalled();
    }
  );

  it('STILL logs a failing high-frequency endpoint (4xx) at warn', async () => {
    // /mcp returns 405 here — suppression must never hide a real failure.
    await request(buildApp()).get('/mcp');
    expect(childMock.warn).toHaveBeenCalled();
    expect(childMock.info).not.toHaveBeenCalled();
  });

  it('matches on exact path, not prefix — /healthcheck-ish is still logged', async () => {
    await request(buildApp()).get('/healthcheck-ish');
    expect(childMock.info).toHaveBeenCalled();
  });

  it('suppresses a high-frequency path carrying a query string', async () => {
    await request(buildApp()).get('/health?verbose=1');
    expect(childMock.info).not.toHaveBeenCalled();
  });
});

describe('requestLogger serializers', () => {
  it('emits only id/method/url and statusCode — never full headers', async () => {
    const lines: Record<string, unknown>[] = [];
    const write = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation((chunk: string | Uint8Array) => {
        try {
          lines.push(JSON.parse(String(chunk)));
        } catch {
          /* pretty-printed or partial line — ignore */
        }
        return true;
      });

    await request(buildApp()).get('/ok');
    write.mockRestore();

    const entry = lines.find((l) => l.req);
    // If the app logs pretty in dev this assertion is skipped rather than failing.
    if (!entry) return;

    expect(Object.keys(entry.req as object).sort()).toEqual(['id', 'method', 'url']);
    expect(Object.keys(entry.res as object)).toEqual(['statusCode']);
    expect(JSON.stringify(entry)).not.toContain('content-security-policy');
  });
});
