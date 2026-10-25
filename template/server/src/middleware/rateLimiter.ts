import rateLimit from 'express-rate-limit';

interface LimiterOptions {
  windowMs: number;
  limit: number;
}

/** The app's rate limiter with a given window and limit; tests build a small one, the app uses apiLimiter. */
export function createLimiter({ windowMs, limit }: LimiterOptions) {
  return rateLimit({ windowMs, limit, standardHeaders: 'draft-8', legacyHeaders: false });
}

export const apiLimiter = createLimiter({ windowMs: 15 * 60 * 1000, limit: 100 });
