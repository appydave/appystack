import { describe, it, expect } from 'vitest';
import { render, screen, renderHook, act } from '@testing-library/react';
import { AppProvider, useApp } from './AppContext.js';

describe('AppProvider', () => {
  it('renders children', () => {
    render(
      <AppProvider>
        <span>hello</span>
      </AppProvider>
    );
    expect(screen.getByText('hello')).toBeInTheDocument();
  });

  it('provides initial state with count 0', () => {
    const { result } = renderHook(() => useApp(), {
      wrapper: AppProvider,
    });
    expect(result.current.state.count).toBe(0);
  });
});

describe('AppContext — actions', () => {
  it('increment action increments count', () => {
    const { result } = renderHook(() => useApp(), {
      wrapper: AppProvider,
    });

    act(() => {
      result.current.dispatch({ type: 'increment' });
    });

    expect(result.current.state.count).toBe(1);
  });

  it('decrement action decrements count', () => {
    const { result } = renderHook(() => useApp(), {
      wrapper: AppProvider,
    });

    act(() => {
      result.current.dispatch({ type: 'decrement' });
    });

    expect(result.current.state.count).toBe(-1);
  });

  it('reset action resets count to 0', () => {
    const { result } = renderHook(() => useApp(), {
      wrapper: AppProvider,
    });

    act(() => {
      result.current.dispatch({ type: 'increment' });
      result.current.dispatch({ type: 'increment' });
      result.current.dispatch({ type: 'increment' });
    });

    expect(result.current.state.count).toBe(3);

    act(() => {
      result.current.dispatch({ type: 'reset' });
    });

    expect(result.current.state.count).toBe(0);
  });
});

describe('useApp — error boundary', () => {
  it('throws when used outside an AppProvider', () => {
    // Suppress the expected error output from React in the test console
    const consoleError = console.error;
    console.error = () => {};

    expect(() => {
      renderHook(() => useApp());
    }).toThrow('useApp must be used within an AppProvider');

    console.error = consoleError;
  });
});
