import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { SwitchRow } from '../SwitchRow';

describe('SwitchRow', () => {
  it('is one native button with switch semantics named by its label', () => {
    render(
      <SwitchRow
        label="WebAble on this site"
        description="Changes apply right away."
      />,
    );
    const control = screen.getByRole('switch', {
      name: 'WebAble on this site',
    });
    expect(control.tagName).toBe('BUTTON');
    expect(control.getAttribute('type')).toBe('button');
    expect(control.getAttribute('aria-checked')).toBe('false');
    expect(control.getAttribute('aria-describedby')).toBeTruthy();
    expect(
      document.getElementById(control.getAttribute('aria-describedby') ?? '')
        ?.textContent,
    ).toBe('Changes apply right away.');
  });

  it('toggles on activation and keeps the state word visible', () => {
    const onCheckedChange = vi.fn();
    render(
      <SwitchRow
        label="Bigger click targets"
        changesPage
        onCheckedChange={onCheckedChange}
      />,
    );
    const control = screen.getByRole('switch');
    expect(control.textContent).toContain('Off');
    // Enter and Space activate a native <button> as a click in every browser.
    fireEvent.click(control);
    expect(control.getAttribute('aria-checked')).toBe('true');
    expect(control.textContent).toContain('On');
    expect(onCheckedChange).toHaveBeenCalledWith(true);
    expect(control.hasAttribute('data-accent')).toBe(true);
  });

  it('works controlled', () => {
    function Controlled() {
      const [on, setOn] = useState(true);
      return (
        <SwitchRow
          label="Reduce motion in WebAble"
          checked={on}
          onCheckedChange={setOn}
        />
      );
    }
    render(<Controlled />);
    const control = screen.getByRole('switch');
    expect(control.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(control);
    expect(control.getAttribute('aria-checked')).toBe('false');
  });

  it('stays focusable when disabled, ignores activation, and links the reason', () => {
    const onCheckedChange = vi.fn();
    render(
      <SwitchRow
        label="Calmer page"
        disabled
        disabledReason="Turn WebAble on for this site first."
        onCheckedChange={onCheckedChange}
      />,
    );
    const control = screen.getByRole('switch');
    expect(control.getAttribute('aria-disabled')).toBe('true');
    expect(control.hasAttribute('disabled')).toBe(false);
    control.focus();
    expect(document.activeElement).toBe(control);
    fireEvent.click(control);
    expect(control.getAttribute('aria-checked')).toBe('false');
    expect(onCheckedChange).not.toHaveBeenCalled();
    const ids = (control.getAttribute('aria-describedby') ?? '').split(' ');
    expect(ids.map((id) => document.getElementById(id)?.textContent)).toContain(
      'Turn WebAble on for this site first.',
    );
  });
});
