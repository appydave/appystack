import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockPino = vi.fn(() => ({ info: vi.fn(), error: vi.fn(), debug: vi.fn() }));

vi.mock('pino', () => ({
  default: mockPino,
}));

describe('logger', () => {
  beforeEach(() => {
    vi.resetModules();
    mockPino.mockClear();
  });

  it('uses level debug and pino-pretty transport in development', async () => {
    vi.doMock('./env.js', () => ({
      env: { isDevelopment: true },
    }));

    await import('./logger.js?' + Date.now());

    expect(mockPino).toHaveBeenCalledOnce();
    const callArg = (
      mockPino.mock.calls[0] as unknown as [{ level: string; transport?: { target: string } }]
    )[0];
    expect(callArg.level).toBe('debug');
    expect(callArg.transport).toBeDefined();
    expect(callArg.transport?.target).toBe('pino-pretty');
  });

  it('uses level info and no transport in production', async () => {
    vi.doMock('./env.js', () => ({
      env: { isDevelopment: false },
    }));

    await import('./logger.js?' + Date.now());

    expect(mockPino).toHaveBeenCalledOnce();
    const callArg = (
      mockPino.mock.calls[0] as unknown as [{ level: string; transport?: unknown }]
    )[0];
    expect(callArg.level).toBe('info');
    expect(callArg.transport).toBeUndefined();
  });

  it('exports a valid pino logger instance with info, error, and debug methods', async () => {
    vi.doMock('./env.js', () => ({
      env: { isDevelopment: false },
    }));

    const { logger } = await import('./logger.js?' + Date.now());

    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.debug).toBe('function');
  });
});
