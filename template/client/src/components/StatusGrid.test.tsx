import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import express from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import StatusGrid from './StatusGrid.js';

// Capture the native fetch at module load time, before any test setup stubs it
const nativeFetch = globalThis.fetch;

let server: Server;
let serverPort: number;

beforeAll(() => {
  return new Promise<void>((resolve) => {
    const app = express();

    app.get('/health', (_req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    app.get('/api/info', (_req, res) => {
      res.json({
        status: 'ok',
        data: {
          nodeVersion: 'v20.0.0',
          environment: 'test',
          port: 5501,
          clientUrl: 'http://localhost:5500',
          uptime: 99,
        },
      });
    });

    server = app.listen(0, () => {
      serverPort = (server.address() as AddressInfo).port;
      resolve();
    });
  });
});

beforeEach(() => {
  globalThis.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === 'string' && input.startsWith('/')
        ? `http://localhost:${serverPort}${input}`
        : input;
    return nativeFetch(url, init);
  };
});

afterAll(() => {
  return new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
});

describe('StatusGrid', () => {
  it('shows loading state on initial render', () => {
    render(<StatusGrid />);
    expect(screen.getByText('Connecting to server...')).toBeInTheDocument();
  });

  it('renders the status-grid container once loaded', async () => {
    render(<StatusGrid />);
    await waitFor(() => expect(screen.getByTestId('status-grid')).toBeInTheDocument(), {
      timeout: 5000,
    });
  });

  it('shows API Health card after loading', async () => {
    render(<StatusGrid />);
    await waitFor(() => expect(screen.getByText('API Health')).toBeInTheDocument(), {
      timeout: 5000,
    });
  });

  it('shows WebSocket card after loading', async () => {
    render(<StatusGrid />);
    await waitFor(() => expect(screen.getByText('WebSocket')).toBeInTheDocument(), {
      timeout: 5000,
    });
  });

  it('shows Environment card after loading', async () => {
    render(<StatusGrid />);
    await waitFor(() => expect(screen.getByText('Environment')).toBeInTheDocument(), {
      timeout: 5000,
    });
  });

  it('shows Runtime card after loading', async () => {
    render(<StatusGrid />);
    await waitFor(() => expect(screen.getByText('Runtime')).toBeInTheDocument(), {
      timeout: 5000,
    });
  });

  it('shows server health status ok after loading', async () => {
    render(<StatusGrid />);
    await waitFor(() => expect(screen.getByText('Status: ok')).toBeInTheDocument(), {
      timeout: 5000,
    });
  });

  it('shows environment info from server', async () => {
    render(<StatusGrid />);
    await waitFor(() => expect(screen.getByText('Mode: test')).toBeInTheDocument(), {
      timeout: 5000,
    });
  });
});

describe('StatusGrid — error state (server unreachable)', () => {
  beforeEach(() => {
    // Override fetch to simulate a server that is completely unreachable
    vi.stubGlobal('fetch', () => Promise.reject(new Error('Network error')));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows error fallback for API Health card', async () => {
    render(<StatusGrid />);
    await waitFor(
      () => {
        // When health is null and there is an error, the fallback paragraph should appear
        // StatusGrid renders "Unable to reach server" or the error message
        const errorTexts = screen.queryAllByText(/Network error|Unable to reach server/);
        expect(errorTexts.length).toBeGreaterThan(0);
      },
      { timeout: 5000 }
    );
  });

  it('shows error fallback for Environment card when info is null', async () => {
    render(<StatusGrid />);
    await waitFor(
      () => {
        // When info is null, both Environment and Runtime cards show the error
        const errorTexts = screen.queryAllByText(/Network error|No data/);
        expect(errorTexts.length).toBeGreaterThan(0);
      },
      { timeout: 5000 }
    );
  });
});
