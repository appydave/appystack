import { describe, it, expect, vi, beforeAll, beforeEach, afterEach, afterAll } from 'vitest';
import { server } from './server.js';
import { http, HttpResponse } from 'msw';

// MSW uses its own fetch interception layer (via @mswjs/interceptors).
// The global setup.ts stubs fetch with vi.fn() for existing tests — those
// stubs take precedence and are intentional.  In this test file we bypass
// the stub so we can demonstrate MSW handler interception working correctly.
//
// Strategy: save the stub installed by setup.ts, replace it with the real
// underlying fetch for the duration of each test, then put it back.

// Start/stop MSW for this file only — MSW is opt-in, not global.
// Global setup.ts stubs fetch with vi.fn() for other tests.
// Here we unstub to let MSW's interceptors handle real fetch calls.
beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

let realFetch: typeof fetch;

beforeEach(() => {
  // Unstub the vi.fn() installed by setup.ts so MSW interceptors work
  vi.unstubAllGlobals();
  realFetch = globalThis.fetch;
});

afterEach(() => {
  // Reinstall the stub so other test files are not affected
  vi.stubGlobal('fetch', vi.fn());
});

describe('MSW example — handler interception', () => {
  it('intercepts GET /health and returns mocked response', async () => {
    const res = await realFetch('http://localhost/health');
    const data = (await res.json()) as { status: string; timestamp: string };

    expect(res.ok).toBe(true);
    expect(data.status).toBe('ok');
    expect(typeof data.timestamp).toBe('string');
  });

  it('intercepts GET /api/info and returns mocked response', async () => {
    const res = await realFetch('http://localhost/api/info');
    const data = (await res.json()) as { name: string; version: string };

    expect(res.ok).toBe(true);
    expect(data.name).toBe('AppyStack');
    expect(data.version).toBe('1.0.0');
  });

  it('allows runtime handler override with server.use()', async () => {
    server.use(
      http.get('*/health', () => {
        return HttpResponse.json(
          { status: 'degraded', timestamp: new Date().toISOString() },
          { status: 503 }
        );
      })
    );

    const res = await realFetch('http://localhost/health');
    const data = (await res.json()) as { status: string };

    expect(res.status).toBe(503);
    expect(data.status).toBe('degraded');
    // setup.ts afterEach calls server.resetHandlers() — restoring defaults for next test
  });
});
