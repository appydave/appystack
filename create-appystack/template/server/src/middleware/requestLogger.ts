import pinoHttp from 'pino-http';
import crypto from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import type { Logger } from 'pino';
import { logger as appLogger } from '../config/logger.js';
import { env } from '../config/env.js';

/**
 * Endpoints that are polled continuously — health checks, status widgets, MCP
 * transports. A *successful* hit on one of these logs at `silent`; failures still
 * log at warn/error, so nothing diagnostic is lost.
 *
 * Why this exists: under any process manager that redirects stdout to a file
 * (launchd, pm2, systemd, a `tee -a` launcher) an info-level access log grows
 * without bound. Measured on Captain's Log 2026-08-04 — 181 MB in 11 days
 * (~21 MB/day), where a single status endpoint was ~50% of all lines; and on
 * FliStudio 2026-10-19 — 950 MB in 16 days. Add your app's own polled routes here.
 */
export const HIGH_FREQUENCY_PATHS = [
  '/health',
  '/healthz',
  '/api/health',
  '/api/status',
  '/api/ingest/status',
  '/mcp',
];

export interface RequestLoggerOptions {
  /**
   * One pretty line per request — `GET /api/x 200 12ms` — with no req/res/
   * responseTime objects attached. pino-pretty prints every extra property on
   * its own lines, so without this a single request costs ~10–55 lines in dev.
   * Defaults to `env.isDevelopment`. Production/test keep structured JSON with
   * the slim req/res serializers below.
   */
  oneLine?: boolean;
  /**
   * Extra "is this a poll?" test, on top of HIGH_FREQUENCY_PATHS — e.g. a single
   * RPC route where only some calls are polled. Runs when the response finishes,
   * so a JSON body is already parsed. Only consulted for successful responses —
   * a failing poll always logs.
   */
  isPoll?: (req: IncomingMessage & { body?: unknown }) => boolean;
  /** Base logger. Defaults to the app logger; tests pass one with a capture stream. */
  logger?: Logger;
}

export function isHighFrequency(url: string | undefined): boolean {
  if (!url) return false;
  const path = url.split('?')[0];
  return HIGH_FREQUENCY_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
}

export function createRequestLogger(options: RequestLoggerOptions = {}) {
  const oneLine = options.oneLine ?? env.isDevelopment;
  const isPoll = options.isPoll;

  return pinoHttp({
    logger: options.logger ?? appLogger,
    genReqId: () => crypto.randomUUID(),
    customLogLevel: (req, res, err) => {
      const status = res.statusCode;
      if (err || status >= 500) return 'error';
      if (status >= 400) return 'warn';
      // Successful polls only — a failing poll still reaches warn/error above.
      if (isHighFrequency(req.url)) return 'silent';
      if (isPoll?.(req)) return 'silent';
      return 'info';
    },
    customSuccessMessage: (req, res, responseTime) =>
      `${req.method} ${req.url} ${res.statusCode} ${responseTime}ms`,
    // pino-http 10 passes responseTime as a 4th argument at runtime; its types
    // only declare three, hence the optional parameter.
    customErrorMessage: (req, res, err, responseTime?: number) =>
      `${req.method} ${req.url} ${res.statusCode}` +
      (responseTime === undefined ? '' : ` ${responseTime}ms`) +
      ` — ${err.message}`,
    // One-line mode: everything worth reading is already in the message. Drop the
    // responseTime/err properties (errorHandler logs the real error with its stack).
    customSuccessObject: oneLine ? () => ({}) : undefined,
    customErrorObject: oneLine ? () => ({}) : undefined,
    /**
     * pino-http's DEFAULT serializers emit every request and response header on
     * every line — including the full Content-Security-Policy string, roughly
     * 600 bytes per entry. Keep only the fields anyone actually reads.
     *
     * In one-line mode they return `undefined`, which pino omits entirely — this
     * removes the `req` binding pino-http attaches to its child logger. These
     * serializers are scoped to that child, so non-request logs elsewhere in the
     * app keep their objects.
     */
    serializers: oneLine
      ? { req: () => undefined, res: () => undefined }
      : {
          req: (req) => ({ id: req.id, method: req.method, url: req.url }),
          res: (res) => ({ statusCode: res.statusCode }),
        },
  });
}

export const requestLogger = createRequestLogger();
