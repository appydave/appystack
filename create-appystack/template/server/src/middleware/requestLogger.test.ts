import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import pino from 'pino';
import { prettyFactory } from 'pino-pretty';
import { requestLogger, createRequestLogger } from './requestLogger.js';
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

/** A pino logger whose output is captured in memory, one entry per write. */
function captureLogger() {
  const lines: string[] = [];
  const log = pino({ level: 'debug' }, { write: (chunk: string) => void lines.push(chunk) });
  return { log, lines, json: () => lines.map((l) => JSON.parse(l) as Record<string, unknown>) };
}

function appWith(mw: ReturnType<typeof createRequestLogger>) {
  const app = express();
  app.use(express.json());
  app.use(mw);
  app.get('/ok', (_req, res) => {
    res.set('content-security-policy', "default-src 'self'").json({ ok: true });
  });
  app.get('/client-error', (_req, res) => {
    res.status(404).json({ error: 'not found' });
  });
  app.get('/server-error', (_req, res) => {
    res.status(500).json({ error: 'crash' });
  });
  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });
  app.post('/api/call', (req, res) => {
    res.status(req.body?.name === 'broken' ? 500 : 200).json({ ok: true });
  });
  return app;
}

describe('requestLogger structured mode (production/test)', () => {
  it('emits only id/method/url and statusCode — never full headers', async () => {
    const cap = captureLogger();
    await request(appWith(createRequestLogger({ oneLine: false, logger: cap.log }))).get('/ok');

    const [entry] = cap.json();
    expect(Object.keys(entry.req as object).sort()).toEqual(['id', 'method', 'url']);
    expect(Object.keys(entry.res as object)).toEqual(['statusCode']);
    expect(entry.responseTime).toEqual(expect.any(Number));
    expect(JSON.stringify(entry)).not.toContain('content-security-policy');
  });
});

describe('requestLogger one-line mode (development)', () => {
  it('writes exactly one entry per request, with no req/res/responseTime objects', async () => {
    const cap = captureLogger();
    await request(appWith(createRequestLogger({ oneLine: true, logger: cap.log }))).get('/ok?x=1');

    expect(cap.lines).toHaveLength(1);
    const [entry] = cap.json();
    expect(entry).not.toHaveProperty('req');
    expect(entry).not.toHaveProperty('res');
    expect(entry).not.toHaveProperty('responseTime');
    expect(entry.msg).toMatch(/^GET \/ok\?x=1 200 \d+ms$/);
  });

  it('renders as a single line through pino-pretty', async () => {
    const cap = captureLogger();
    await request(appWith(createRequestLogger({ oneLine: true, logger: cap.log }))).get('/ok');

    const format = prettyFactory({ colorize: false, ignore: 'pid,hostname' });
    const text = format(cap.lines[0]) as string;
    expect(text.trimEnd().split('\n')).toHaveLength(1);
    expect(text).toMatch(/INFO.*GET \/ok 200 \d+ms/);
  });

  it('logs a 4xx at warn as one line', async () => {
    const cap = captureLogger();
    await request(appWith(createRequestLogger({ oneLine: true, logger: cap.log }))).get(
      '/client-error'
    );
    const [entry] = cap.json();
    expect(cap.lines).toHaveLength(1);
    expect(entry.level).toBe(40);
    expect(entry.msg).toMatch(/^GET \/client-error 404 \d+ms$/);
  });

  it('logs a 5xx at error as one line, with no err object', async () => {
    const cap = captureLogger();
    await request(appWith(createRequestLogger({ oneLine: true, logger: cap.log }))).get(
      '/server-error'
    );
    const [entry] = cap.json();
    expect(cap.lines).toHaveLength(1);
    expect(entry.level).toBe(50);
    expect(entry).not.toHaveProperty('err');
    expect(entry.msg).toMatch(/^GET \/server-error 500 \d+ms — failed with status code 500$/);
  });

  it('writes nothing for a successful /health', async () => {
    const cap = captureLogger();
    await request(appWith(createRequestLogger({ oneLine: true, logger: cap.log }))).get('/health');
    expect(cap.lines).toHaveLength(0);
  });

  it('does not strip objects from non-request logs on the same base logger', () => {
    const cap = captureLogger();
    createRequestLogger({ oneLine: true, logger: cap.log });
    cap.log.info({ req: { id: 'x' }, job: 7 }, 'unrelated');
    const [entry] = cap.json();
    expect(entry.req).toEqual({ id: 'x' });
    expect(entry.job).toBe(7);
  });
});

describe('requestLogger isPoll hook', () => {
  const isPoll = (req: { method?: string; url?: string; body?: unknown }) =>
    req.url === '/api/call' && (req.body as { name?: string } | undefined)?.name === 'recents';

  it('silences a successful call the hook marks as a poll', async () => {
    const cap = captureLogger();
    await request(appWith(createRequestLogger({ oneLine: true, isPoll, logger: cap.log })))
      .post('/api/call')
      .send({ name: 'recents' });
    expect(cap.lines).toHaveLength(0);
  });

  it('still logs calls the hook does not mark', async () => {
    const cap = captureLogger();
    await request(appWith(createRequestLogger({ oneLine: true, isPoll, logger: cap.log })))
      .post('/api/call')
      .send({ name: 'save' });
    expect(cap.lines).toHaveLength(1);
  });

  it('still logs a FAILING poll', async () => {
    const cap = captureLogger();
    const poll = () => true;
    await request(appWith(createRequestLogger({ oneLine: true, isPoll: poll, logger: cap.log })))
      .post('/api/call')
      .send({ name: 'broken' });
    expect(cap.lines).toHaveLength(1);
    expect(cap.json()[0].level).toBe(50);
  });
});
