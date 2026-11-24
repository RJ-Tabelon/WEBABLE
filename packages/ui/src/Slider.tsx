'use client';

import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import { IconButton } from './IconButton';
import { cx } from './internal/cx';
import { useControllableState } from './internal/state';

export interface SliderProps {
  /** Visible label and accessible name (also used in the stepper labels). */
  label: string;
  /**
   * The allowed values, ascending. Profile values are ladders, for example text
   * size {14, 16, 18, 21, 24, 28, 32} px. Every step gets a tick.
   */
  steps: readonly number[];
  value?: number;
  defaultValue?: number;
  /** Fires on every step change (dragging, keys, steppers). */
  onValueChange?: (value: number) => void;
  /**
   * Fires once the value has rested for `commitDelay` ms: the moment a live
   * preview should apply. The page is never animated while dragging.
   */
  onValueCommit?: (value: number) => void;
  /** Milliseconds without movement before `onValueCommit`. Default 150. */
  commitDelay?: number;
  /** Visible value, for example `(v) => \`${v} px\``. Use digits and a unit. */
  format?: (value: number) => string;
  /** Spoken value for `aria-valuetext`, for example `(v) => \`${v} pixels\``. */
  formatSpoken?: (value: number) => string;
  /** The slider changes a page: the fill and the value use the fern accent. */
  changesPage?: boolean;
  /** Never faded: steppers and thumb become `aria-disabled`. */
  disabled?: boolean;
  /** Labels for the − and + steppers. Default "Decrease {label}" / "Increase {label}". */
  decrementLabel?: string;
  incrementLabel?: string;
  id?: string;
  className?: string;
}

const PAGE = 3;

function nearestIndex(steps: readonly number[], value: number): number {
  let best = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  steps.forEach((step, i) => {
    const d = Math.abs(step - value);
    if (d < bestDistance) {
      best = i;
      bestDistance = d;
    }
  });
  return best;
}

/**
 * Slider with mandatory steppers (design-final §7.6). The steppers are the
 * single-pointer alternative to dragging (WCAG 2.5.7). Keyboard: arrows ±1 step,
 * Page Up/Down ±3, Home/End to the ends.
 */
export function Slider({
  label,
  steps,
  value,
  defaultValue,
  onValueChange,
  onValueCommit,
  commitDelay = 150,
  format = (v) => String(v),
  formatSpoken,
  changesPage = false,
  disabled = false,
  decrementLabel,
  incrementLabel,
  id,
  className,
}: SliderProps) {
  if (steps.length < 2) throw new Error('Slider needs at least two steps.');
  const [current, setCurrent] = useControllableState<number>(
    value,
    defaultValue ?? (steps[0] as number),
    onValueChange,
  );
  const index = nearestIndex(steps, current);
  const shown = steps[index] as number;
  const last = steps.length - 1;
  const pct = (i: number) => (i / last) * 100;

  const uid = useId();
  const labelId = `${uid}-label`;
  const thumbRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const commitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onCommitRef = useRef(onValueCommit);
  onCommitRef.current = onValueCommit;
  const [dragging, setDragging] = useState(false);
  const [announcement, setAnnouncement] = useState('');

  useEffect(
    () => () => {
      if (commitTimer.current) clearTimeout(commitTimer.current);
    },
    [],
  );

  const spoken = (v: number) => (formatSpoken ? formatSpoken(v) : format(v));

  const setIndex = (next: number, via: 'thumb' | 'stepper' = 'thumb') => {
    if (disabled) return;
    const clamped = Math.min(last, Math.max(0, next));
    const nextValue = steps[clamped] as number;
    if (nextValue === shown) return;
    setCurrent(nextValue);
    if (via === 'stepper') setAnnouncement(`${label}: ${spoken(nextValue)}`);
    if (commitTimer.current) clearTimeout(commitTimer.current);
    commitTimer.current = setTimeout(
      () => onCommitRef.current?.(nextValue),
      commitDelay,
    );
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const rtl = thumbRef.current
      ? window.getComputedStyle(thumbRef.current).direction === 'rtl'
      : false;
    let next: number | null = null;
    switch (event.key) {
      case 'ArrowRight':
        next = rtl ? index - 1 : index + 1;
        break;
      case 'ArrowUp':
        next = index + 1;
        break;
      case 'ArrowLeft':
        next = rtl ? index + 1 : index - 1;
        break;
      case 'ArrowDown':
        next = index - 1;
        break;
      case 'PageUp':
        next = index + PAGE;
        break;
      case 'PageDown':
        next = index - PAGE;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = last;
        break;
      default:
        return;
    }
    event.preventDefault();
    setIndex(next);
  };

  const indexFromPointer = (clientX: number): number => {
    const rail = railRef.current;
    if (!rail) return index;
    const rect = rail.getBoundingClientRect();
    if (rect.width <= 0) return index;
    const rtl = window.getComputedStyle(rail).direction === 'rtl';
    let ratio = (clientX - rect.left) / rect.width;
    if (rtl) ratio = 1 - ratio;
    return Math.round(Math.min(1, Math.max(0, ratio)) * last);
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (disabled || event.button !== 0) return;
    event.preventDefault();
    thumbRef.current?.focus();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setDragging(true);
    setIndex(indexFromPointer(event.clientX));
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    setIndex(indexFromPointer(event.clientX));
  };

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    setDragging(false);
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  return (
    <div
      id={id}
      className={cx('wa-slider', className)}
      data-accent={changesPage || undefined}
      data-disabled={disabled || undefined}
    >
      <div className="wa-slider__head">
        <span id={labelId} className="wa-slider__label">
          {label}
        </span>
        <span className="wa-slider__value" aria-hidden="true">
          {format(shown)}
        </span>
      </div>
      <div className="wa-slider__body">
        <IconButton
          icon="minus"
          variant="secondary"
          label={decrementLabel ?? `Decrease ${label.toLowerCase()}`}
          tooltip={false}
          disabled={disabled || index === 0}
          onClick={() => setIndex(index - 1, 'stepper')}
        />
        <div
          ref={railRef}
          className="wa-slider__rail"
          data-dragging={dragging || undefined}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <div className="wa-slider__track" aria-hidden="true">
            <div
              className="wa-slider__fill"
              style={{ width: `${pct(index)}%` }}
            />
          </div>
          <div className="wa-slider__ticks" aria-hidden="true">
            {steps.map((step, i) => (
              <span
                key={step}
                className="wa-slider__tick"
                style={{ insetInlineStart: `${pct(i)}%` }}
              />
            ))}
          </div>
          <div
            ref={thumbRef}
            role="slider"
            tabIndex={0}
            aria-labelledby={labelId}
            aria-valuemin={steps[0]}
            aria-valuemax={steps[last]}
            aria-valuenow={shown}
            aria-valuetext={spoken(shown)}
            aria-orientation="horizontal"
            aria-disabled={disabled || undefined}
            className="wa-slider__thumb"
            style={{ insetInlineStart: `${pct(index)}%` }}
            onKeyDown={onKeyDown}
          />
          <div className="wa-slider__steps" aria-hidden="true">
            {steps.map((step, i) => (
              <span
                key={step}
                className={cx(
                  'wa-slider__step',
                  (i === 0 || i === last) && 'wa-slider__step--end',
                  i === index && 'wa-slider__step--current',
                )}
                style={{ insetInlineStart: `${pct(i)}%` }}
              >
                {step}
              </span>
            ))}
          </div>
        </div>
        <IconButton
          icon="plus"
          variant="secondary"
          label={incrementLabel ?? `Increase ${label.toLowerCase()}`}
          tooltip={false}
          disabled={disabled || index === last}
          onClick={() => setIndex(index + 1, 'stepper')}
        />
      </div>
      <span className="sr-only" aria-live="polite">
        {announcement}
      </span>
    </div>
  );
}
