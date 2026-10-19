import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider, useToast, type ToastOptions } from '../Toast';

let api: ReturnType<typeof useToast> | null = null;

function Grab() {
  api = useToast();
  return null;
}

function show(options: ToastOptions) {
  act(() => {
    api?.show(options);
  });
}

function Page() {
  return (
    <ToastProvider duration={6000}>
      <main>
        <h1>Your fit</h1>
        <button type="button">Adjust text size</button>
      </main>
      <Grab />
    </ToastProvider>
  );
}

describe('Toast focus and errors', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    api = null;
  });

  it('returns focus to where it was when Undo is pressed inside the toast', () => {
    render(<Page />);
    const adjust = screen.getByRole('button', { name: 'Adjust text size' });
    adjust.focus();
    const onAction = vi.fn();
    show({
      message: 'Text size is now 19 px.',
      action: { label: 'Undo', onAction },
    });
    // The person tabs into the toast and presses Undo.
    const undo = screen.getByRole('button', { name: 'Undo' });
    undo.focus();
    fireEvent.click(undo);
    expect(onAction).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(adjust);
    act(() => vi.advanceTimersByTime(500));
    expect(document.activeElement).not.toBe(document.body);
    expect(document.activeElement).toBe(adjust);
  });

  it('falls back to main h1 when the original element is gone', () => {
    const { rerender } = render(<Page />);
    const adjust = screen.getByRole('button', { name: 'Adjust text size' });
    adjust.focus();
    show({ message: 'Saved.', action: { label: 'Undo', onAction: () => {} } });
    // The element that had focus unmounts (an editor closing).
    adjust.remove();
    const undo = screen.getByRole('button', { name: 'Undo' });
    undo.focus();
    fireEvent.click(undo);
    const heading = screen.getByRole('heading', { level: 1 });
    expect(document.activeElement).toBe(heading);
    expect(heading.getAttribute('tabindex')).toBe('-1');
    rerender(<Page />);
  });

  it('keeps the first return target when a toast replaces itself from inside', () => {
    render(<Page />);
    const adjust = screen.getByRole('button', { name: 'Adjust text size' });
    adjust.focus();
    show({
      message: 'Text size is now 19 px.',
      action: {
        label: 'Undo',
        onAction: () => api?.show({ message: 'Text size is back to 16 px.' }),
      },
    });
    const undo = screen.getByRole('button', { name: 'Undo' });
    undo.focus();
    act(() => fireEvent.click(undo));
    expect(document.activeElement).toBe(adjust);
    expect(screen.getByText('Text size is back to 16 px.')).toBeTruthy();
  });

  it('accepts an explicit returnFocus', () => {
    render(<Page />);
    const heading = screen.getByRole('heading', { level: 1 });
    const adjust = screen.getByRole('button', { name: 'Adjust text size' });
    show({
      message: 'Saved.',
      returnFocus: adjust,
      action: { label: 'Undo', onAction: () => {} },
    });
    heading.tabIndex = -1;
    const undo = screen.getByRole('button', { name: 'Undo' });
    undo.focus();
    fireEvent.click(undo);
    expect(document.activeElement).toBe(adjust);
  });

  it('lets a plain toast time out, but keeps an error until dismissed', () => {
    render(<Page />);
    show({ message: 'Saved.' });
    act(() => vi.advanceTimersByTime(6000));
    act(() => vi.advanceTimersByTime(500));
    expect(screen.queryByText('Saved.')).toBeNull();

    show({ message: 'Couldn’t undo. Try again.', tone: 'error' });
    act(() => vi.advanceTimersByTime(60_000));
    expect(screen.getByText('Couldn’t undo. Try again.')).toBeTruthy();
    const toast = screen
      .getByText('Couldn’t undo. Try again.')
      .closest('.wa-toast');
    expect(toast?.getAttribute('data-tone')).toBe('error');
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    act(() => vi.advanceTimersByTime(500));
    expect(screen.queryByText('Couldn’t undo. Try again.')).toBeNull();
  });
});
