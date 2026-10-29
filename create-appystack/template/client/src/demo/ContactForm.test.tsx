import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ContactForm from './ContactForm.js';

describe('ContactForm', () => {
  it('shows every validation message when sent empty', async () => {
    render(<ContactForm />);

    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect(await screen.findByText('Name must be at least 2 characters')).toBeInTheDocument();
    expect(screen.getByText('Invalid email address')).toBeInTheDocument();
    expect(screen.getByText('Message must be at least 10 characters')).toBeInTheDocument();
  });

  it('submits valid input', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    render(<ContactForm />);
    fireEvent.input(screen.getByLabelText('Name'), { target: { value: 'Ada' } });
    fireEvent.input(screen.getByLabelText('Email'), { target: { value: 'ada@example.com' } });
    fireEvent.input(screen.getByLabelText('Message'), { target: { value: 'Hello from the test' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await vi.waitFor(() =>
      expect(log).toHaveBeenCalledWith({
        name: 'Ada',
        email: 'ada@example.com',
        message: 'Hello from the test',
      })
    );
    expect(screen.queryAllByRole('alert')).toHaveLength(0);
    log.mockRestore();
  });
});
