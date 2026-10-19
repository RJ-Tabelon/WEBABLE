import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SegmentedControl } from '../SegmentedControl';

const options = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
] as const;

function setup(onValueChange = vi.fn()) {
  render(
    <SegmentedControl
      label="Theme"
      options={options}
      defaultValue="light"
      onValueChange={onValueChange}
    />,
  );
  return { onValueChange, radios: screen.getAllByRole('radio') };
}

describe('SegmentedControl', () => {
  it('exposes a labelled radio group with one checked radio', () => {
    const { radios } = setup();
    expect(screen.getByRole('radiogroup', { name: 'Theme' })).toBeTruthy();
    expect(radios.map((r) => r.getAttribute('aria-checked'))).toEqual([
      'false',
      'true',
      'false',
    ]);
  });

  it('uses a roving tabindex: only the selected radio is in the tab order', () => {
    const { radios } = setup();
    expect(radios.map((r) => r.tabIndex)).toEqual([-1, 0, -1]);
  });

  it('moves selection and focus with arrow keys, wrapping at the ends', () => {
    const { radios, onValueChange } = setup();
    const [system, light, dark] = radios as [
      HTMLElement,
      HTMLElement,
      HTMLElement,
    ];
    light.focus();

    fireEvent.keyDown(light, { key: 'ArrowRight' });
    expect(dark.getAttribute('aria-checked')).toBe('true');
    expect(document.activeElement).toBe(dark);
    expect(onValueChange).toHaveBeenLastCalledWith('dark');

    fireEvent.keyDown(dark, { key: 'ArrowRight' });
    expect(system.getAttribute('aria-checked')).toBe('true');
    expect(document.activeElement).toBe(system);

    fireEvent.keyDown(system, { key: 'ArrowLeft' });
    expect(dark.getAttribute('aria-checked')).toBe('true');

    fireEvent.keyDown(dark, { key: 'ArrowUp' });
    expect(light.getAttribute('aria-checked')).toBe('true');
    expect(light.tabIndex).toBe(0);
    expect(dark.tabIndex).toBe(-1);
  });

  it('jumps to the ends with Home and End', () => {
    const { radios } = setup();
    const [system, light, dark] = radios as [
      HTMLElement,
      HTMLElement,
      HTMLElement,
    ];
    fireEvent.keyDown(light, { key: 'End' });
    expect(dark.getAttribute('aria-checked')).toBe('true');
    fireEvent.keyDown(dark, { key: 'Home' });
    expect(system.getAttribute('aria-checked')).toBe('true');
  });

  it('skips disabled options', () => {
    render(
      <SegmentedControl
        label="View"
        options={[
          { value: 'a', label: 'Original' },
          { value: 'b', label: 'Fitted', disabled: true },
          { value: 'c', label: 'Compare' },
        ]}
        defaultValue="a"
      />,
    );
    const [a, b, c] = screen.getAllByRole('radio') as [
      HTMLElement,
      HTMLElement,
      HTMLElement,
    ];
    fireEvent.keyDown(a, { key: 'ArrowRight' });
    expect(c.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(b);
    expect(b.getAttribute('aria-checked')).toBe('false');
  });

  it('ignores keys it does not own so Tab can leave the group', () => {
    const { radios, onValueChange } = setup();
    const light = radios[1] as HTMLElement;
    const event = fireEvent.keyDown(light, { key: 'Tab' });
    expect(event).toBe(true); // not prevented
    expect(onValueChange).not.toHaveBeenCalled();
  });
});
