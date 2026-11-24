'use client';

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { cx } from './internal/cx';
import { useControllableState } from './internal/state';

export interface SegmentedOption<T extends string = string> {
  value: T;
  label: ReactNode;
  disabled?: boolean;
}

interface SegmentedBaseProps<T extends string> {
  /** 2 to 4 options. With more, or if a label would wrap at 20em, use `Select`. */
  options: ReadonlyArray<SegmentedOption<T>>;
  value?: T;
  defaultValue?: T;
  onValueChange?: (value: T) => void;
  /** Stretch to the container with equal segments. */
  fill?: boolean;
  className?: string;
  id?: string;
}

export type SegmentedControlProps<T extends string = string> =
  SegmentedBaseProps<T> &
    (
      | { label: string; labelledBy?: undefined }
      | { label?: undefined; labelledBy: string }
    );

// Server rendering has no layout; use the layout effect only in the browser.
const useIsoLayoutEffect =
  typeof window === 'undefined' ? useEffect : useLayoutEffect;

/**
 * Segmented control (design-final §7.5) with radio-group semantics and a roving
 * tabindex: arrow keys move the selection, Home and End jump to the ends, Tab
 * leaves the group. The raised indicator slides over `--dur-2` and jumps under
 * reduced motion.
 */
export function SegmentedControl<T extends string = string>({
  options,
  value,
  defaultValue,
  onValueChange,
  fill = false,
  className,
  id,
  label,
  labelledBy,
}: SegmentedControlProps<T>) {
  const firstEnabled = options.find((o) => !o.disabled)?.value;
  const [selected, setSelected] = useControllableState<T | undefined>(
    value,
    defaultValue ?? firstEnabled,
    onValueChange as ((v: T | undefined) => void) | undefined,
  );
  const groupRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef(new Map<T, HTMLButtonElement>());
  const [indicator, setIndicator] = useState<{ x: number; w: number } | null>(
    null,
  );
  const [animate, setAnimate] = useState(false);
  const uid = useId();

  const measure = useCallback(() => {
    const group = groupRef.current;
    const item =
      selected === undefined ? undefined : itemRefs.current.get(selected);
    if (!group || !item) {
      setIndicator(null);
      return;
    }
    setIndicator({ x: item.offsetLeft, w: item.offsetWidth });
  }, [selected]);

  useIsoLayoutEffect(measure, [measure]);

  useEffect(() => {
    const group = groupRef.current;
    if (!group || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => measure());
    observer.observe(group);
    return () => observer.disconnect();
  }, [measure]);

  // Enable the slide only after the first measured paint, so it never slides in on load.
  useEffect(() => {
    if (!indicator || animate) return;
    const frame = requestAnimationFrame(() => setAnimate(true));
    return () => cancelAnimationFrame(frame);
  }, [indicator, animate]);

  const enabled = options.filter((o) => !o.disabled);
  const tabStop =
    selected !== undefined && enabled.some((o) => o.value === selected)
      ? selected
      : enabled[0]?.value;

  const select = (next: T) => {
    if (next !== selected) setSelected(next);
    itemRefs.current.get(next)?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (enabled.length === 0) return;
    const rtl =
      typeof window !== 'undefined' && groupRef.current
        ? window.getComputedStyle(groupRef.current).direction === 'rtl'
        : false;
    const current = enabled.findIndex(
      (o) => o.value === (event.target as HTMLElement).dataset.value,
    );
    const index = current < 0 ? 0 : current;
    let next: number | null = null;
    switch (event.key) {
      case 'ArrowRight':
        next = rtl ? index - 1 : index + 1;
        break;
      case 'ArrowLeft':
        next = rtl ? index + 1 : index - 1;
        break;
      case 'ArrowDown':
        next = index + 1;
        break;
      case 'ArrowUp':
        next = index - 1;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = enabled.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    const wrapped = (next + enabled.length) % enabled.length;
    const option = enabled[wrapped];
    if (option) select(option.value);
  };

  return (
    <div
      ref={groupRef}
      id={id}
      role="radiogroup"
      aria-label={label}
      aria-labelledby={labelledBy}
      className={cx('wa-segmented', fill && 'wa-segmented--fill', className)}
      data-ready={indicator ? '' : undefined}
      data-animate={animate ? '' : undefined}
      onKeyDown={onKeyDown}
    >
      {indicator ? (
        <span
          className="wa-segmented__indicator"
          aria-hidden="true"
          style={{
            transform: `translateX(${indicator.x}px)`,
            width: `${indicator.w}px`,
          }}
        />
      ) : null}
      {options.map((option) => {
        const isSelected = option.value === selected;
        return (
          <button
            key={option.value}
            ref={(el) => {
              if (el) itemRefs.current.set(option.value, el);
              else itemRefs.current.delete(option.value);
            }}
            id={`${uid}-${option.value}`}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-disabled={option.disabled || undefined}
            tabIndex={option.value === tabStop ? 0 : -1}
            data-value={option.value}
            className="wa-segmented__item"
            onClick={() => {
              if (!option.disabled) select(option.value);
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
