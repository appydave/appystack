import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import LandingPage from './LandingPage.js';

describe('LandingPage', () => {
  it('renders the AppyStack ASCII banner tagline', () => {
    render(<LandingPage />);
    expect(screen.getByText(/Production-ready RVETS stack boilerplate/)).toBeInTheDocument();
  });

  it('renders the placeholder content message', () => {
    render(<LandingPage />);
    expect(screen.getByText(/Your app content goes here/)).toBeInTheDocument();
  });

  it('references DemoPage in the placeholder text', () => {
    render(<LandingPage />);
    expect(screen.getByText('src/demo/DemoPage.tsx')).toBeInTheDocument();
  });

  it('renders a main content area', () => {
    render(<LandingPage />);
    expect(document.querySelector('main')).toBeInTheDocument();
  });

  it('renders a header element', () => {
    render(<LandingPage />);
    expect(document.querySelector('header')).toBeInTheDocument();
  });
});
