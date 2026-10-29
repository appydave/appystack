import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';

describe('main.tsx', () => {
  it('mounts the app into #root', async () => {
    document.body.innerHTML = '<div id="root"></div>';

    await import('./main.js');

    expect(await screen.findByText(/Production-ready RVETS stack boilerplate/)).toBeInTheDocument();
    expect(document.getElementById('root')?.childElementCount).toBeGreaterThan(0);
  });
});
