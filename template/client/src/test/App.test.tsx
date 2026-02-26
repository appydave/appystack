import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../App.js';

// Mock hooks to avoid real network calls
vi.mock('../hooks/useServerStatus.js', () => ({
  useServerStatus: () => ({
    health: { status: 'ok', timestamp: new Date().toISOString() },
    info: {
      nodeVersion: 'v22.0.0',
      environment: 'test',
      port: 5501,
      clientUrl: 'http://localhost:5500',
      uptime: 42,
    },
    loading: false,
    error: null,
  }),
}));

vi.mock('../hooks/useSocket.js', () => ({
  useSocket: () => ({ socket: null, connected: true }),
}));

describe('App', () => {
  it('renders the tagline', () => {
    render(<App />);
    expect(screen.getByText(/Production-ready RVETS stack boilerplate/)).toBeInTheDocument();
  });

  it('displays the status grid', () => {
    render(<App />);
    expect(screen.getByTestId('status-grid')).toBeInTheDocument();
  });

  it('displays the tech stack section', () => {
    render(<App />);
    expect(screen.getByTestId('tech-stack')).toBeInTheDocument();
  });
});
