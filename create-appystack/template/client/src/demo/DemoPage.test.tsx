import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DemoPage from './DemoPage.js';

describe('DemoPage', () => {
  it('shows and hides the example form', () => {
    render(<DemoPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Show example form' }));

    expect(screen.getByRole('heading', { name: 'React Hook Form + Zod' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Hide example form' }));

    expect(screen.queryByRole('heading', { name: 'React Hook Form + Zod' })).toBeNull();
  });
});
