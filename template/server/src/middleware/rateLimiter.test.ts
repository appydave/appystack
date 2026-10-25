import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import type { RequestHandler } from 'express';
import { apiLimiter, createLimiter } from './rateLimiter.js';

// Tests use the app's own limiter factory with a very low limit, so they can trigger 429 without
// sending 100 real requests.
function buildApp(limiter: RequestHandler) {
  const app = express();
  app.use(limiter);
  app.get('/ping', (_req, res) => {
    res.json({ ok: true });
  });
  return app;
}

describe('rateLimiter middleware', () => {
  it('allows requests under the limit', async () => {
    const app = buildApp(createLimiter({ windowMs: 60_000, limit: 5 }));

    const res = await request(app).get('/ping');

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('returns 429 once the per-window limit is exceeded', async () => {
    const app = buildApp(createLimiter({ windowMs: 60_000, limit: 3 }));

    // Send 3 allowed requests
    for (let i = 0; i < 3; i++) {
      const res = await request(app).get('/ping');
      expect(res.status).toBe(200);
    }

    // The 4th request should be rate-limited
    const limited = await request(app).get('/ping');
    expect(limited.status).toBe(429);
  });

  it('includes RateLimit headers on successful responses', async () => {
    const app = buildApp(createLimiter({ windowMs: 60_000, limit: 10 }));

    const res = await request(app).get('/ping');

    // draft-8 headers use RateLimit-* format
    expect(res.status).toBe(200);
    // At least one rate-limit related header should be present
    const headers = Object.keys(res.headers).join(' ').toLowerCase();
    expect(headers).toMatch(/ratelimit/);
  });

  it('does not set legacy X-RateLimit headers', async () => {
    const app = buildApp(createLimiter({ windowMs: 60_000, limit: 10 }));

    const res = await request(app).get('/ping');

    expect(res.headers['x-ratelimit-limit']).toBeUndefined();
    expect(res.headers['x-ratelimit-remaining']).toBeUndefined();
  });

  it('the app limiter allows 100 requests per 15 minutes', async () => {
    const res = await request(buildApp(apiLimiter)).get('/ping');

    expect(res.status).toBe(200);
    expect(res.headers['ratelimit-policy']).toMatch(/q=100; w=900/);
  });
});
