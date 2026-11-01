import { vi } from 'vitest';

/**
 * A mock whose type fits any function slot, so a third-party signature
 * (pino's child logger) can be stubbed without a cast.
 */
export function looseFn(impl: () => unknown) {
  return vi.fn().mockImplementation(impl);
}

/**
 * Stub process.exit so a failed module load or a shutdown does not end the test
 * run. The type argument states what the real function promises (`never`); the
 * stub does return, which is what lets the caller carry on and be asserted on.
 */
export function mockProcessExit() {
  return vi
    .spyOn(process, 'exit')
    .mockImplementation(vi.fn<(code?: number | string | null) => never>());
}
