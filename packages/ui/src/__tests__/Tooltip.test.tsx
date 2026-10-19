import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { IconButton } from '../IconButton';

describe('Tooltip', () => {
  it('shows immediately on keyboard focus, survives a scroll, and Esc dismisses it', async () => {
    render(<IconButton icon="settings" label="Settings" />);
    const button = screen.getByRole('button', { name: 'Settings' });
    fireEvent.keyDown(document.body, { key: 'Tab' });
    act(() => button.focus());
    expect(screen.getByRole('tooltip').textContent).toBe('Settings');

    // Focus that scrolls the page must not close it.
    act(() => {
      window.dispatchEvent(new Event('scroll'));
      document.dispatchEvent(new Event('scroll'));
    });
    expect(screen.queryByRole('tooltip')).not.toBeNull();

    fireEvent.keyDown(button, { key: 'Escape' });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('is not rendered for an icon button with tooltip={false}', () => {
    render(<IconButton icon="x" label="Dismiss" tooltip={false} />);
    const button = screen.getByRole('button', { name: 'Dismiss' });
    fireEvent.keyDown(document.body, { key: 'Tab' });
    act(() => button.focus());
    expect(screen.queryByRole('tooltip')).toBeNull();
  });
});
