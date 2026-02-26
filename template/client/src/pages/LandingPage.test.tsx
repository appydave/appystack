import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import express from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import LandingPage from './LandingPage.js';

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
          uptime: 10,
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

describe('LandingPage', () => {
  it('renders the AppyStack ASCII banner tagline', () => {
    render(<LandingPage />);
    expect(screen.getByText(/Production-ready RVETS stack boilerplate/)).toBeInTheDocument();
  });

  it('renders the System Status section heading', () => {
    render(<LandingPage />);
    expect(screen.getByText('System Status')).toBeInTheDocument();
  });

  it('renders the Socket.io section heading', () => {
    render(<LandingPage />);
    // Use heading role to distinguish the section heading from tech stack items
    expect(screen.getByRole('heading', { name: 'Socket.io' })).toBeInTheDocument();
  });

  it('renders the Tech Stack section', () => {
    render(<LandingPage />);
    expect(screen.getByText('Tech Stack')).toBeInTheDocument();
  });

  it('renders the SocketDemo component with Send Ping button', () => {
    render(<LandingPage />);
    expect(screen.getByRole('button', { name: 'Send Ping' })).toBeInTheDocument();
  });

  it('renders the tech stack data-testid container', async () => {
    render(<LandingPage />);
    await waitFor(() => expect(screen.getByTestId('tech-stack')).toBeInTheDocument(), {
      timeout: 5000,
    });
  });

  it('renders the status-grid container after loading', async () => {
    render(<LandingPage />);
    await waitFor(() => expect(screen.getByTestId('status-grid')).toBeInTheDocument(), {
      timeout: 5000,
    });
  });
});
