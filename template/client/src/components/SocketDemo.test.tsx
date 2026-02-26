import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import SocketDemo from './SocketDemo.js';

describe('SocketDemo', () => {
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
    // On initial render, connected=false so the button is disabled
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
