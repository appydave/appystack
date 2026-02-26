import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import express from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import StatusGrid from './StatusGrid.js';

let server: Server;
let originalFetch: typeof globalThis.fetch;

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
      const port = (server.address() as AddressInfo).port;

      originalFetch = globalThis.fetch;
      globalThis.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
        const url =
          typeof input === 'string' && input.startsWith('/')
            ? `http://localhost:${port}${input}`
            : input;
        return originalFetch(url, init);
      };

      resolve();
    });
  });
});

afterAll(() => {
  return new Promise<void>((resolve) => {
    globalThis.fetch = originalFetch;
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
