import { describe, it, expect } from 'vitest';
import { ROUTES, SOCKET_EVENTS } from '@appystack-template/shared';

describe('shared constants — SOCKET_EVENTS', () => {
  it('CLIENT_PING is defined and is a string', () => {
    expect(SOCKET_EVENTS.CLIENT_PING).toBeDefined();
    expect(typeof SOCKET_EVENTS.CLIENT_PING).toBe('string');
  });

  it('SERVER_PONG is defined and is a string', () => {
    expect(SOCKET_EVENTS.SERVER_PONG).toBeDefined();
    expect(typeof SOCKET_EVENTS.SERVER_PONG).toBe('string');
  });

  it('CLIENT_PING and SERVER_PONG have distinct values', () => {
    expect(SOCKET_EVENTS.CLIENT_PING).not.toBe(SOCKET_EVENTS.SERVER_PONG);
  });
});

describe('shared constants — ROUTES', () => {
  it('HEALTH is defined and is a string', () => {
    expect(ROUTES.HEALTH).toBeDefined();
    expect(typeof ROUTES.HEALTH).toBe('string');
  });

  it('API_INFO is defined and is a string', () => {
    expect(ROUTES.API_INFO).toBeDefined();
    expect(typeof ROUTES.API_INFO).toBe('string');
  });

  it('HEALTH and API_INFO have distinct values', () => {
    expect(ROUTES.HEALTH).not.toBe(ROUTES.API_INFO);
  });
});

describe('shared index — all named exports resolve without error', () => {
  it('re-exports ROUTES from shared index', async () => {
    const shared = await import('@appystack-template/shared');
    expect(shared.ROUTES).toBeDefined();
  });

  it('re-exports SOCKET_EVENTS from shared index', async () => {
    const shared = await import('@appystack-template/shared');
    expect(shared.SOCKET_EVENTS).toBeDefined();
  });

  it('shared module has no unexpected undefined top-level exports', async () => {
    const shared = await import('@appystack-template/shared');
    // All value exports should be defined (type-only exports are erased at runtime)
    const valueExports = Object.entries(shared).filter(([, v]) => v !== undefined);
    expect(valueExports.length).toBeGreaterThan(0);
  });
});
