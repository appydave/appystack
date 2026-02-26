import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ContactForm from './ContactForm.js';

describe('ContactForm — renders', () => {
  it('renders the name field', () => {
    render(<ContactForm />);
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
  });

  it('renders the email field', () => {
    render(<ContactForm />);
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });

  it('renders the message field', () => {
    render(<ContactForm />);
    expect(screen.getByLabelText('Message')).toBeInTheDocument();
  });

  it('renders the submit button', () => {
    render(<ContactForm />);
    expect(screen.getByRole('button', { name: 'Send' })).toBeInTheDocument();
  });
});

describe('ContactForm — validation errors', () => {
  it('shows validation error when name is too short', async () => {
    const user = userEvent.setup();
    render(<ContactForm />);

    await user.type(screen.getByLabelText('Name'), 'A');
    await user.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => {
      const alerts = screen.getAllByRole('alert');
      const nameError = alerts.find(
        (el) => el.textContent === 'Name must be at least 2 characters'
      );
      expect(nameError).toBeTruthy();
    });
  });

  it('shows validation error for invalid email', async () => {
    const user = userEvent.setup();
    render(<ContactForm />);

    await user.type(screen.getByLabelText('Email'), 'not-an-email');
    await user.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => {
      const alerts = screen.getAllByRole('alert');
      const emailError = alerts.find((el) => el.textContent === 'Invalid email address');
      expect(emailError).toBeTruthy();
    });
  });

  it('shows validation error when message is too short', async () => {
    const user = userEvent.setup();
    render(<ContactForm />);

    await user.type(screen.getByLabelText('Message'), 'Too short');
    await user.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => {
      const alerts = screen.getAllByRole('alert');
      const msgError = alerts.find((el) =>
        el.textContent?.includes('Message must be at least 10 characters')
      );
      expect(msgError).toBeTruthy();
    });
  });
});

describe('ContactForm — valid submission', () => {
  it('calls onSubmit with correct data when form is valid', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const user = userEvent.setup();
    render(<ContactForm />);

    await user.type(screen.getByLabelText('Name'), 'Alice Example');
    await user.type(screen.getByLabelText('Email'), 'alice@example.com');
    await user.type(screen.getByLabelText('Message'), 'Hello, this is a valid test message.');
    await user.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith({
        name: 'Alice Example',
        email: 'alice@example.com',
        message: 'Hello, this is a valid test message.',
      });
    });

    consoleSpy.mockRestore();
  });
});
