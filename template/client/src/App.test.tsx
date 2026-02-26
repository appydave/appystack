import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import express from 'express';
import type { Server } from 'node:http';
import App from './App.js';

let server: Server;

beforeAll(
  () =>
    new Promise<void>((resolve) => {
      const app = express();
      app.get('/health', (_, res) =>
        res.json({ status: 'ok', timestamp: new Date().toISOString() })
      );
      app.get('/api/info', (_, res) =>
        res.json({
          status: 'ok',
          data: { nodeVersion: 'test', environment: 'test', port: 0, clientUrl: '', uptime: 0 },
        })
      );
      server = app.listen(0, () => {
        const port = (server.address() as { port: number }).port;
        globalThis.fetch = (input, init) => {
          const url =
            typeof input === 'string' && input.startsWith('/')
              ? `http://localhost:${port}${input}`
              : input;
          return fetch(url, init);
        };
        resolve();
      });
    })
);

afterAll(
  () =>
    new Promise<void>((resolve) => {
      server?.close(() => resolve());
    })
);

describe('App', () => {
  it('renders the tagline', async () => {
    render(<App />);
    expect(screen.getByText(/Production-ready RVETS stack boilerplate/)).toBeInTheDocument();
  });

  it('displays the status grid', async () => {
    render(<App />);
    expect(screen.getByTestId('status-grid')).toBeInTheDocument();
  });

  it('displays the tech stack section', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByTestId('tech-stack')).toBeInTheDocument());
  });
});
