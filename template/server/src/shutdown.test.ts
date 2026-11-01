import { describe, it, expect, vi, afterAll, beforeEach } from 'vitest';
import { httpServer } from './index.js';
import { mockProcessExit } from './test/looseFn.js';

describe('signal handler registration', () => {
  it('registers a SIGTERM listener on the process', () => {
    expect(process.listenerCount('SIGTERM')).toBeGreaterThan(0);
  });

  it('registers a SIGINT listener on the process', () => {
    expect(process.listenerCount('SIGINT')).toBeGreaterThan(0);
  });
});

describe('graceful shutdown', () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    exitSpy = mockProcessExit();
    exitSpy.mockClear();
  });

  afterAll(() => {
    // Restore process.exit so subsequent code can exit normally
    exitSpy?.mockRestore();

    // Close the httpServer to prevent test hangs if it is still listening
    return new Promise<void>((resolve) => {
      if (httpServer.listening) {
        httpServer.close(() => resolve());
      } else {
        resolve();
      }
    });
  });

  function stubClose() {
    const originalClose = httpServer.close.bind(httpServer);

    // Invoke the real close so handles are released, but call cb immediately
    return vi.spyOn(httpServer, 'close').mockImplementation((cb?: (err?: Error) => void) => {
      if (cb) {
        cb();
      }

      return originalClose();
    });
  }

  it('calls process.exit(0) when SIGTERM is emitted', async () => {
    const closeSpy = stubClose();

    try {
      process.emit('SIGTERM');
      await vi.waitFor(() => expect(exitSpy).toHaveBeenCalledWith(0));
    } finally {
      closeSpy.mockRestore();
    }
  });

  it('calls process.exit(0) when SIGINT is emitted', async () => {
    const closeSpy = stubClose();

    try {
      process.emit('SIGINT');
      await vi.waitFor(() => expect(exitSpy).toHaveBeenCalledWith(0));
    } finally {
      closeSpy.mockRestore();
    }
  });

  it('passes 0 as the exit code to process.exit', async () => {
    const closeSpy = stubClose();

    try {
      process.emit('SIGTERM');
      await vi.waitFor(() => expect(exitSpy.mock.calls.at(-1)?.[0]).toBe(0));
    } finally {
      closeSpy.mockRestore();
    }
  });
});
