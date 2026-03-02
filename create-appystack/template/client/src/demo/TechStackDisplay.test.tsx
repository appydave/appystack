import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import TechStackDisplay from './TechStackDisplay.js';

describe('TechStackDisplay', () => {
  it('renders the Tech Stack heading', () => {
    render(<TechStackDisplay />);
    expect(screen.getByText('Tech Stack')).toBeInTheDocument();
  });

  it('renders the Client category', () => {
    render(<TechStackDisplay />);
    expect(screen.getByText('Client')).toBeInTheDocument();
  });

  it('renders the Server category', () => {
    render(<TechStackDisplay />);
    expect(screen.getByText('Server')).toBeInTheDocument();
  });

  it('renders the Cross-cutting category', () => {
    render(<TechStackDisplay />);
    expect(screen.getByText('Cross-cutting')).toBeInTheDocument();
  });

  it('renders the Testing & Quality category', () => {
    render(<TechStackDisplay />);
    expect(screen.getByText('Testing & Quality')).toBeInTheDocument();
  });

  it('renders all 4 categories in the tech stack', () => {
    render(<TechStackDisplay />);
    const container = screen.getByTestId('tech-stack');
    // 4 category headings: Client, Server, Cross-cutting, Testing & Quality
    const categoryHeadings = container.querySelectorAll('h3');
    expect(categoryHeadings).toHaveLength(4);
  });

  it('renders React in the Client category', () => {
    render(<TechStackDisplay />);
    expect(screen.getByText('React')).toBeInTheDocument();
  });

  it('renders Express in the Server category', () => {
    render(<TechStackDisplay />);
    expect(screen.getByText('Express')).toBeInTheDocument();
  });

  it('renders TypeScript in the Cross-cutting category', () => {
    render(<TechStackDisplay />);
    expect(screen.getByText('TypeScript')).toBeInTheDocument();
  });

  it('renders Vitest in the Testing & Quality category', () => {
    render(<TechStackDisplay />);
    expect(screen.getByText('Vitest')).toBeInTheDocument();
  });

  it('renders the data-testid attribute', () => {
    render(<TechStackDisplay />);
    expect(screen.getByTestId('tech-stack')).toBeInTheDocument();
  });
});
