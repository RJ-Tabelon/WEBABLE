'use client';

import { useEffect, useState, type ReactNode, type Ref } from 'react';
import { StatusShape, type StatusState } from './glyphs';
import { cx } from './internal/cx';
import {
  STATUS_LABELS,
  STOP_CHECKING_MS,
  type ExtensionStatus,
} from './statusLabels';

/**
 * True once `state` has been `checking` for 5 s. Nothing loops forever: after
 * that the arc becomes a static half ring and the label says "Still checking".
 */
export function useStillChecking(state: ExtensionStatus): boolean {
  const [still, setStill] = useState(false);
  useEffect(() => {
    setStill(false);
    if (state !== 'checking') return;
    const timer = setTimeout(() => setStill(true), STOP_CHECKING_MS);
    return () => clearTimeout(timer);
  }, [state]);
  return state === 'checking' && still;
}

function shapeFor(state: ExtensionStatus, still: boolean): StatusState {
  return state === 'checking' && still ? 'still-checking' : state;
}

export interface StatusGlyphProps {
  state: ExtensionStatus;
  /** 16 in pills and rows, 20 in the popup state line. */
  size?: 16 | 20;
  className?: string;
}

/** A status glyph on its own. Decorative: pair it with a word. */
export function StatusGlyph({ state, size = 16, className }: StatusGlyphProps) {
  const still = useStillChecking(state);
  return (
    <StatusShape
      state={shapeFor(state, still)}
      size={size}
      className={className}
    />
  );
}

export interface StatusLineProps {
  state: ExtensionStatus;
  /** Title (20 / medium). Defaults to the short label. For `adapted`, pass "Adapted · 3 changes". */
  title?: ReactNode;
  /** Title shown after 5 s of checking. Default "Still checking". */
  stillCheckingTitle?: ReactNode;
  /** Element for the title. The popup uses `h1` so the state is announced first. */
  as?: 'h1' | 'h2' | 'h3' | 'p' | 'div';
  /** Make the title focusable by script (the popup focuses it on open). */
  focusable?: boolean;
  titleRef?: Ref<HTMLElement>;
  className?: string;
}

/** The popup state line: 20 px glyph, 8 px gap, 20 / medium title. */
export function StatusLine({
  state,
  title,
  stillCheckingTitle = 'Still checking',
  as: Tag = 'p',
  focusable = false,
  titleRef,
  className,
}: StatusLineProps) {
  const still = useStillChecking(state);
  const text = still ? stillCheckingTitle : (title ?? STATUS_LABELS[state]);
  return (
    <Tag
      ref={titleRef as Ref<never>}
      tabIndex={focusable ? -1 : undefined}
      className={cx('wa-status-line', `wa-status-line--${state}`, className)}
    >
      <StatusShape state={shapeFor(state, still)} size={20} />
      <span className="wa-status-line__title">{text}</span>
    </Tag>
  );
}

export interface StatusPillProps {
  state: ExtensionStatus;
  /** Label (15 / medium). Defaults to the short label; for `adapted` pass "Adapted · 3". */
  label?: ReactNode;
  className?: string;
}

/** Status pill for lists such as the app's Sites page: 32 high, tonal. Not interactive. */
export function StatusPill({ state, label, className }: StatusPillProps) {
  const still = useStillChecking(state);
  const text = still ? 'Still checking' : (label ?? STATUS_LABELS[state]);
  return (
    <span
      className={cx('wa-status-pill', `wa-status-pill--${state}`, className)}
    >
      <StatusShape state={shapeFor(state, still)} size={16} />
      <span>{text}</span>
    </span>
  );
}
