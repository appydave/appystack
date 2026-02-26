import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import healthRouter from '../routes/health.js';
import infoRouter from '../routes/info.js';

const app = express();
app.use(healthRouter);
app.use(infoRouter);

describe('GET /health', () => {
  it('returns ok status', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.timestamp).toBeDefined();
  });
});

describe('GET /api/info', () => {
  it('returns server info', async () => {
    const res = await request(app).get('/api/info');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.data).toBeDefined();
    expect(res.body.data.nodeVersion).toMatch(/^v\d+/);
    expect(res.body.data.environment).toBeDefined();
    expect(res.body.data.port).toBeDefined();
    expect(res.body.data.uptime).toBeGreaterThanOrEqual(0);
  });
});
