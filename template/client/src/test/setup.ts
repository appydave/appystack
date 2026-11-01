import '@testing-library/jest-dom';
import { vi, beforeEach } from 'vitest';

// Global fetch stub for all tests.
// Tests that need real fetch interception should call vi.unstubAllGlobals() in their own
// beforeEach and manage their own interception lifecycle.
beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});
