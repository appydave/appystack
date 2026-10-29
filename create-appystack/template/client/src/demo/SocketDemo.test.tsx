import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { startPongServer, type PongServer } from '../test/pongServer.js';
import SocketDemo from './SocketDemo.js';

let server: PongServer;

beforeAll(async () => {
  server = await startPongServer();
  vi.stubEnv('VITE_SOCKET_URL', server.url);
});

afterAll(async () => {
  vi.unstubAllEnvs();
  await server.close();
});

describe('SocketDemo', () => {
  it('connects, sends a ping and shows the pong', async () => {
    render(<SocketDemo />);

    expect(await screen.findByText('Status: connected')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Send Ping' }));

    expect(await screen.findByText(/server:pong received — pong/)).toBeInTheDocument();
  });
});
