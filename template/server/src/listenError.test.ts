import { describe, it, expect, vi } from 'vitest';
import { onListenError, portInUseMessage } from './listenError.js';

describe('listen errors', () => {
  it('names the port and how to find its holder', () => {
    expect(portInUseMessage(5501)).toBe(
      'Port 5501 is already in use. Find the process with: lsof -i :5501. Stop it, or set PORT in .env.'
    );
  });

  it('exits 1 with the message when the port is in use', () => {
    const exit = vi.fn();
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const err: NodeJS.ErrnoException = new Error('listen EADDRINUSE');

    err.code = 'EADDRINUSE';
    onListenError(5501, exit)(err);

    expect(exit).toHaveBeenCalledWith(1);
    expect(error).toHaveBeenCalledWith(portInUseMessage(5501));
    error.mockRestore();
  });

  it('rethrows any other listen error', () => {
    const exit = vi.fn();
    const err: NodeJS.ErrnoException = new Error('listen EACCES');

    err.code = 'EACCES';

    expect(() => onListenError(80, exit)(err)).toThrow('listen EACCES');
    expect(exit).not.toHaveBeenCalled();
  });
});
