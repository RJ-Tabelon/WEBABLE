import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Slider } from '../Slider';

const LADDER = [14, 16, 18, 21, 24, 28, 32] as const;

function setup(props: Partial<Parameters<typeof Slider>[0]> = {}) {
  const onValueChange = vi.fn();
  const onValueCommit = vi.fn();
  render(
    <Slider
      label="Text size"
      steps={LADDER}
      defaultValue={18}
      format={(v) => `${v} px`}
      formatSpoken={(v) => `${v} pixels`}
      changesPage
      onValueChange={onValueChange}
      onValueCommit={onValueCommit}
      {...props}
    />,
  );
  return {
    slider: screen.getByRole('slider', { name: 'Text size' }),
    decrease: screen.getByRole('button', { name: 'Decrease text size' }),
    increase: screen.getByRole('button', { name: 'Increase text size' }),
    onValueChange,
    onValueCommit,
  };
}

describe('Slider', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('exposes the real value and a spoken value text', () => {
    const { slider } = setup();
    expect(slider.getAttribute('aria-valuenow')).toBe('18');
    expect(slider.getAttribute('aria-valuemin')).toBe('14');
    expect(slider.getAttribute('aria-valuemax')).toBe('32');
    expect(slider.getAttribute('aria-valuetext')).toBe('18 pixels');
  });

  it('steps along the ladder with the − and + steppers', () => {
    const { slider, decrease, increase, onValueChange } = setup();
    fireEvent.click(increase);
    expect(slider.getAttribute('aria-valuenow')).toBe('21');
    expect(onValueChange).toHaveBeenLastCalledWith(21);
    fireEvent.click(decrease);
    fireEvent.click(decrease);
    expect(slider.getAttribute('aria-valuenow')).toBe('16');
  });

  it('announces stepper changes politely', () => {
    const { increase } = setup();
    fireEvent.click(increase);
    expect(
      screen.getByText('Text size: 21 pixels').getAttribute('aria-live'),
    ).toBe('polite');
  });

  it('marks a stepper aria-disabled at the end of the ladder and ignores it', () => {
    const { slider, decrease, increase } = setup({ defaultValue: 32 });
    expect(increase.getAttribute('aria-disabled')).toBe('true');
    expect(decrease.getAttribute('aria-disabled')).toBeNull();
    fireEvent.click(increase);
    expect(slider.getAttribute('aria-valuenow')).toBe('32');
  });

  it('supports arrows, Page Up/Down (3 steps) and Home/End on the thumb', () => {
    const { slider } = setup();
    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    expect(slider.getAttribute('aria-valuenow')).toBe('21');
    fireEvent.keyDown(slider, { key: 'ArrowDown' });
    expect(slider.getAttribute('aria-valuenow')).toBe('18');
    fireEvent.keyDown(slider, { key: 'PageUp' });
    expect(slider.getAttribute('aria-valuenow')).toBe('28');
    fireEvent.keyDown(slider, { key: 'PageUp' });
    expect(slider.getAttribute('aria-valuenow')).toBe('32');
    fireEvent.keyDown(slider, { key: 'Home' });
    expect(slider.getAttribute('aria-valuenow')).toBe('14');
    fireEvent.keyDown(slider, { key: 'End' });
    expect(slider.getAttribute('aria-valuenow')).toBe('32');
    fireEvent.keyDown(slider, { key: 'PageDown' });
    expect(slider.getAttribute('aria-valuenow')).toBe('21');
  });

  it('commits once the value rests for 150 ms', () => {
    const { slider, onValueCommit } = setup();
    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    act(() => vi.advanceTimersByTime(149));
    expect(onValueCommit).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onValueCommit).toHaveBeenCalledTimes(1);
    expect(onValueCommit).toHaveBeenCalledWith(24);
  });

  it('snaps an off-ladder value to the nearest step', () => {
    const { slider } = setup({ defaultValue: 20 });
    expect(slider.getAttribute('aria-valuenow')).toBe('21');
  });

  it('does nothing when disabled', () => {
    const { slider, increase } = setup({ disabled: true });
    expect(slider.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(increase);
    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    expect(slider.getAttribute('aria-valuenow')).toBe('18');
  });
});
