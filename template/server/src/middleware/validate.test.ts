import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express, { type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { validate } from './validate.js';

// Attach a catch-all error handler so unhandled errors produce a JSON body for assertions
function withErrorHandler(app: ReturnType<typeof express>) {
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    res.status(500).json({ status: 'error', error: err.message });
  });
  return app;
}

const nameSchema = z.object({ name: z.string().min(1) });
const paramsSchema = z.object({ id: z.string().uuid() });

function buildBodyApp() {
  const app = express();
  app.use(express.json());
  app.post('/items', validate({ body: nameSchema }), (req, res) => {
    res.json({ received: req.body });
  });
  return withErrorHandler(app);
}

function buildParamsApp() {
  const app = express();
  app.get('/items/:id', validate({ params: paramsSchema }), (req, res) => {
    res.json({ id: req.params.id });
  });
  return withErrorHandler(app);
}

// Query-only validation: Zod parses req.query without mutating it.
// We verify invalid inputs are rejected with 400 (Zod error path).
// We do not test valid-input body passthrough here because req.query
// is a getter-only property in Express 5 / Node's IncomingMessage;
// assigning the parsed value would throw TypeError.
function buildQueryValidationApp() {
  const querySchema = z.object({ page: z.string().regex(/^\d+$/, 'must be digits only') });
  const app = express();
  app.get('/items', validate({ query: querySchema }), (_req, res) => {
    res.json({ ok: true });
  });
  return withErrorHandler(app);
}

describe('validate middleware — body', () => {
  const app = buildBodyApp();

  it('passes valid body to the route handler', async () => {
    const res = await request(app)
      .post('/items')
      .send({ name: 'Widget' })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(200);
    expect(res.body.received.name).toBe('Widget');
  });

  it('returns 400 with Zod errors when body field fails validation', async () => {
    const res = await request(app)
      .post('/items')
      .send({ name: '' })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(400);
    expect(res.body.status).toBe('error');
    expect(Array.isArray(res.body.error)).toBe(true);
    expect(res.body.timestamp).toBeDefined();
  });

  it('returns 400 when required body field is missing', async () => {
    const res = await request(app).post('/items').send({}).set('Content-Type', 'application/json');

    expect(res.status).toBe(400);
    expect(res.body.status).toBe('error');
    expect(Array.isArray(res.body.error)).toBe(true);
  });
});

describe('validate middleware — query', () => {
  const app = buildQueryValidationApp();

  it('returns 400 with Zod errors when query parameter fails validation', async () => {
    const res = await request(app).get('/items?page=abc');

    expect(res.status).toBe(400);
    expect(res.body.status).toBe('error');
    expect(Array.isArray(res.body.error)).toBe(true);
  });

  it('returns 400 when required query parameter is missing', async () => {
    const res = await request(app).get('/items');

    expect(res.status).toBe(400);
    expect(res.body.status).toBe('error');
  });
});

describe('validate middleware — params', () => {
  const app = buildParamsApp();

  it('passes valid UUID param to the route handler', async () => {
    const uuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    const res = await request(app).get(`/items/${uuid}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(uuid);
  });

  it('returns 400 with Zod errors for invalid UUID param', async () => {
    const res = await request(app).get('/items/not-a-uuid');

    expect(res.status).toBe(400);
    expect(res.body.status).toBe('error');
    expect(Array.isArray(res.body.error)).toBe(true);
  });
});
