import pinoHttp from 'pino-http';
import crypto from 'node:crypto';
import { logger } from '../config/logger.js';

/**
 * Endpoints that are polled continuously — health checks, status widgets, MCP
 * transports. A *successful* hit on one of these logs at `silent`; failures still
 * log at warn/error, so nothing diagnostic is lost.
 *
 * Why this exists: under any process manager that redirects stdout to a file
 * (launchd, pm2, systemd) an info-level access log grows without bound. Measured
 * on Captain's Log 2026-08-04 — 181 MB in 11 days (~21 MB/day, ~7.6 GB/year),
 * where a single status endpoint was ~50% of all lines.
 */
const HIGH_FREQUENCY_PATHS = [
  '/health',
  '/healthz',
  '/api/health',
  '/api/status',
  '/api/ingest/status',
  '/mcp',
];

function isHighFrequency(url: string | undefined): boolean {
  if (!url) return false;
  const path = url.split('?')[0];
  return HIGH_FREQUENCY_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
}

export const requestLogger = pinoHttp({
  logger,
  genReqId: () => crypto.randomUUID(),
  customLogLevel: (req, res, err) => {
    const status = res.statusCode;
    if (err || status >= 500) return 'error';
    if (status >= 400) return 'warn';
    // Successful polls only — a failing poll still reaches warn/error above.
    if (isHighFrequency(req.url)) return 'silent';
    return 'info';
  },
  customSuccessMessage: (req, res) => {
    return `${req.method} ${req.url} ${res.statusCode}`;
  },
  /**
   * pino-http's DEFAULT serializers emit every request and response header on
   * every line — including the full Content-Security-Policy string, roughly
   * 600 bytes per entry. Keep only the fields anyone actually reads.
   */
  serializers: {
    req: (req) => ({ id: req.id, method: req.method, url: req.url }),
    res: (res) => ({ statusCode: res.statusCode }),
  },
});
