import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

// Hoisted mutable state so vi.mock factory can reference it
const mockSocketState = vi.hoisted(() => ({
  socket: null as { once: ReturnType<typeof vi.fn>; emit: ReturnType<typeof vi.fn> } | null,
  connected: false,
  mockOnce: vi.fn(),
  mockEmit: vi.fn(),
}));

vi.mock('../hooks/useSocket.js', () => ({
  useSocket: () => ({
    socket: mockSocketState.socket,
    connected: mockSocketState.connected,
  }),
}));

import SocketDemo from './SocketDemo.js';

describe('SocketDemo — disconnected (default)', () => {
  beforeEach(() => {
    mockSocketState.socket = null;
    mockSocketState.connected = false;
    mockSocketState.mockOnce.mockReset();
    mockSocketState.mockEmit.mockReset();
  });

  it('renders the Socket.io Demo heading', () => {
    render(<SocketDemo />);
    expect(screen.getByText('Socket.io Demo')).toBeInTheDocument();
  });

  it('renders the Send Ping button', () => {
    render(<SocketDemo />);
    expect(screen.getByRole('button', { name: 'Send Ping' })).toBeInTheDocument();
  });

  it('renders the Send Ping button disabled when disconnected', () => {
    render(<SocketDemo />);
    const button = screen.getByRole('button', { name: 'Send Ping' });
    expect(button).toBeDisabled();
  });

  it('shows disconnected status on initial render', () => {
    render(<SocketDemo />);
    expect(screen.getByText('Status: disconnected')).toBeInTheDocument();
  });

  it('does not show pong response before any ping is sent', () => {
    render(<SocketDemo />);
    expect(screen.queryByText(/server:pong received/)).not.toBeInTheDocument();
  });
});

describe('SocketDemo — connected state', () => {
  beforeEach(() => {
    mockSocketState.mockOnce.mockReset();
    mockSocketState.mockEmit.mockReset();
    mockSocketState.socket = {
      once: mockSocketState.mockOnce,
      emit: mockSocketState.mockEmit,
    };
    mockSocketState.connected = true;
  });

  it('shows connected status when socket is connected', () => {
    render(<SocketDemo />);
    expect(screen.getByText('Status: connected')).toBeInTheDocument();
  });

  it('button is enabled when connected', () => {
    render(<SocketDemo />);
    const button = screen.getByRole('button', { name: 'Send Ping' });
    expect(button).not.toBeDisabled();
  });

  it('sendPing calls socket.once and socket.emit when clicked', async () => {
    render(<SocketDemo />);
    const button = screen.getByRole('button', { name: 'Send Ping' });

    await act(async () => {
      fireEvent.click(button);
    });

    expect(mockSocketState.mockOnce).toHaveBeenCalledTimes(1);
    expect(mockSocketState.mockEmit).toHaveBeenCalledTimes(1);
  });

  it('shows waiting state after ping is sent', async () => {
    // mockOnce never fires, so waiting=true persists
    mockSocketState.mockOnce.mockImplementation(() => {});

    render(<SocketDemo />);
    const button = screen.getByRole('button', { name: 'Send Ping' });

    await act(async () => {
      fireEvent.click(button);
    });

    expect(screen.getByText('Waiting for pong...')).toBeInTheDocument();
  });

  it('shows pong response after server:pong event fires', async () => {
    let pongHandler: ((data: { message: string; timestamp: string }) => void) | null = null;
    mockSocketState.mockOnce.mockImplementation(
      (_event: string, handler: (data: { message: string; timestamp: string }) => void) => {
        pongHandler = handler;
      }
    );

    render(<SocketDemo />);
    const button = screen.getByRole('button', { name: 'Send Ping' });

    await act(async () => {
      fireEvent.click(button);
    });

    await act(async () => {
      pongHandler?.({ message: 'pong', timestamp: new Date().toISOString() });
    });

    expect(screen.getByText(/server:pong received/)).toBeInTheDocument();
  });
});

describe('SocketDemo — disconnect after connect', () => {
  it('Send Ping button is disabled when socket disconnects', () => {
    // Start disconnected — simulate a socket that has dropped
    mockSocketState.socket = null;
    mockSocketState.connected = false;

    render(<SocketDemo />);
    const button = screen.getByRole('button', { name: 'Send Ping' });
    expect(button).toBeDisabled();
  });

  it('shows disconnected status text when socket is not connected', () => {
    mockSocketState.socket = null;
    mockSocketState.connected = false;

    render(<SocketDemo />);
    expect(screen.getByText('Status: disconnected')).toBeInTheDocument();
  });

  it('Send Ping button becomes enabled when socket reconnects', () => {
    // Simulate reconnection: connected=true and socket object available
    mockSocketState.mockOnce.mockReset();
    mockSocketState.mockEmit.mockReset();
    mockSocketState.socket = {
      once: mockSocketState.mockOnce,
      emit: mockSocketState.mockEmit,
    };
    mockSocketState.connected = true;

    render(<SocketDemo />);
    const button = screen.getByRole('button', { name: 'Send Ping' });
    expect(button).not.toBeDisabled();
  });
});
