import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Disclosure } from '../Disclosure';

describe('Disclosure', () => {
  it('is a native button inside a heading, wired to its panel', () => {
    render(
      <Disclosure title="What does WebAble send?">
        <p>Page structure only.</p>
      </Disclosure>,
    );
    const trigger = screen.getByRole('button', {
      name: 'What does WebAble send?',
    });
    expect(trigger.tagName).toBe('BUTTON');
    expect(trigger.getAttribute('type')).toBe('button');
    expect(trigger.closest('h3')).not.toBeNull();
    const panel = document.getElementById(
      trigger.getAttribute('aria-controls') ?? '',
    );
    expect(panel).not.toBeNull();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('keeps collapsed content findable with hidden="until-found"', () => {
    render(<Disclosure title="Why?">It made text overlap here.</Disclosure>);
    const trigger = screen.getByRole('button', { name: 'Why?' });
    const panel = document.getElementById(
      trigger.getAttribute('aria-controls') ?? '',
    ) as HTMLElement;
    expect(panel.getAttribute('hidden')).toBe('until-found');
  });

  it('toggles on activation (Enter and Space activate native buttons)', () => {
    vi.useFakeTimers();
    const onOpenChange = vi.fn();
    render(
      <Disclosure title="Adjust for this site" onOpenChange={onOpenChange}>
        Text size
      </Disclosure>,
    );
    const trigger = screen.getByRole('button', {
      name: 'Adjust for this site',
    });
    const panel = document.getElementById(
      trigger.getAttribute('aria-controls') ?? '',
    ) as HTMLElement;

    fireEvent.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(panel.hasAttribute('hidden')).toBe(false);
    expect(onOpenChange).toHaveBeenLastCalledWith(true);

    fireEvent.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    // The panel stays visible while it collapses, then becomes hidden until found.
    act(() => vi.runAllTimers());
    expect(panel.getAttribute('hidden')).toBe('until-found');
    vi.useRealTimers();
  });

  it('opens when find-in-page reveals its content (beforematch)', () => {
    render(<Disclosure title="Details">Code 17</Disclosure>);
    const trigger = screen.getByRole('button', { name: 'Details' });
    const panel = document.getElementById(
      trigger.getAttribute('aria-controls') ?? '',
    ) as HTMLElement;
    act(() => {
      panel.dispatchEvent(new Event('beforematch'));
    });
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
  });

  it('can render without a heading wrapper', () => {
    render(
      <Disclosure title="Details" headingLevel={null}>
        x
      </Disclosure>,
    );
    expect(
      screen.getByRole('button', { name: 'Details' }).closest('h3'),
    ).toBeNull();
  });
});
