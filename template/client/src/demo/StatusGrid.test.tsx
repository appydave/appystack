import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import StatusGrid from './StatusGrid.js';

const state = vi.hoisted(() => ({
  status: {},
  connected: false,
}));

vi.mock('../hooks/useServerStatus.js', () => ({ useServerStatus: () => state.status }));
vi.mock('../hooks/useSocket.js', () => ({ useSocket: () => ({ connected: state.connected }) }));

const info = { environment: 'staging', port: 5501, nodeVersion: 'v22.1.0', uptime: 12.7 };

describe('StatusGrid', () => {
  beforeEach(() => {
    state.connected = false;
  });

  it('shows the connecting message while loading', () => {
    state.status = { loading: true, health: null, info: null, error: null };
    render(<StatusGrid />);

    expect(screen.getByText('Connecting to server...')).toBeInTheDocument();
    expect(screen.queryByTestId('status-grid')).toBeNull();
  });

  it('shows health, socket, environment and runtime when the server answers', () => {
    state.connected = true;
    state.status = { loading: false, health: { status: 'ok' }, info, error: null };
    render(<StatusGrid />);

    expect(screen.getByText('Status: ok')).toBeInTheDocument();
    expect(screen.getByText('Status: connected')).toBeInTheDocument();
    expect(screen.getByText('Mode: staging')).toBeInTheDocument();
    expect(screen.getByText('Port: 5501')).toBeInTheDocument();
    expect(screen.getByText('Node: v22.1.0')).toBeInTheDocument();
    expect(screen.getByText('Uptime: 12s')).toBeInTheDocument();
  });

  it('shows the error in the environment and runtime cards when there is no info', () => {
    state.status = { loading: false, health: null, info: null, error: 'boom' };
    render(<StatusGrid />);

    expect(screen.getAllByText('boom')).toHaveLength(3);
    expect(screen.getByText('Status: disconnected')).toBeInTheDocument();
  });

  it('falls back to fixed text when there is no error either', () => {
    state.status = { loading: false, health: null, info: null, error: null };
    render(<StatusGrid />);

    expect(screen.getByText('Unable to reach server')).toBeInTheDocument();
    expect(screen.getAllByText('No data')).toHaveLength(2);
  });
});
