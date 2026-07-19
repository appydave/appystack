import { createLogger } from '@appydave/core';
import { env } from './env.js';

/**
 * Base application logger — backed by @appydave/core's `createLogger` (Pino under
 * the hood). Pretty, human-readable output in development; structured JSON in
 * production and test. The vendor choice lives in @appydave/core; this file is the
 * seam, so swapping the logging library is a one-package change, not a repo sweep.
 *
 * Returns a raw Pino instance, so `pino-http` (see middleware/requestLogger.ts)
 * consumes it directly.
 */
export const logger = createLogger({
  name: 'app',
  level: env.isDevelopment ? 'debug' : 'info',
  pretty: env.isDevelopment,
});
