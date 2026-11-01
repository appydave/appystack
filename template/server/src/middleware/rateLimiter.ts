import rateLimit from 'express-rate-limit';

interface LimiterOptions {
  windowMs: number;
  limit: number;
}

/** The app's rate limiter with a given window and limit; tests build a small one, the app uses apiLimiter. */
export function createLimiter({ windowMs, limit }: LimiterOptions) {
  return rateLimit({ windowMs, limit, standardHeaders: 'draft-8', legacyHeaders: false });
}

const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const WINDOW_MINUTES = 15;
const WINDOW_MS = WINDOW_MINUTES * SECONDS_PER_MINUTE * MS_PER_SECOND;

export const apiLimiter = createLimiter({ windowMs: WINDOW_MS, limit: 100 });
