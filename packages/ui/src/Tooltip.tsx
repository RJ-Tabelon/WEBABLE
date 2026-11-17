'use client';

import {
  useEffect,
  useRef,
  useState,
  type DOMAttributes,
  type ReactElement,
  type ReactNode,
} from 'react';
import {
  Focusable,
  Tooltip as AriaTooltip,
  TooltipTrigger,
} from 'react-aria-components';
import { useOverlayContainer } from './internal/overlay';

export type TooltipPlacement = 'top' | 'bottom' | 'start' | 'end';

export interface TooltipProps {
  /** Supplementary text only: never the only copy of a label, never a link. */
  content: ReactNode;
  /** One focusable element that accepts a ref (a native button or link). */
  children: ReactElement<DOMAttributes<HTMLElement>, string>;
  placement?: TooltipPlacement;
  /** Hover delay in ms. Keyboard focus shows it immediately. Default 500 (`--delay-tooltip`). */
  delay?: number;
  isDisabled?: boolean;
}

/**
 * Keyboard focus on an element below the fold scrolls it into view, and React Aria
 * closes tooltips on any scroll. For this long after a keyboard focus, a close that
 * is not Esc or blur is ignored so the tooltip stays with the focused control.
 */
const KEEP_AFTER_FOCUS_MS = 400;

/**
 * Tooltip (design-final §7.15): inverse surface, meta text, offset 8, no arrow.
 * Appears after 500 ms on hover and immediately on keyboard focus, stays while the
 * pointer is over it, and Esc dismisses it (WCAG 1.4.13). Never shown for touch.
 */
export function Tooltip({
  content,
  children,
  placement = 'top',
  delay = 500,
  isDisabled,
}: TooltipProps) {
  const container = useOverlayContainer();
  const [isOpen, setOpen] = useState(false);
  const trigger = useRef<HTMLElement | null>(null);
  const keepUntil = useRef(0);
  const escaped = useRef(false);

  // Window capture runs before React Aria's document listener, so Esc is known first.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') escaped.current = true;
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, []);

  const onOpenChange = (next: boolean) => {
    if (!next && !escaped.current) {
      const el = trigger.current;
      const stillFocused = el !== null && el === document.activeElement;
      if (stillFocused && performance.now() < keepUntil.current) return;
    }
    escaped.current = false;
    setOpen(next);
  };

  return (
    <span
      className="wa-tooltip-anchor"
      onFocusCapture={(event) => {
        const target = event.target as HTMLElement;
        trigger.current = target;
        escaped.current = false;
        if (target.matches(':focus-visible'))
          keepUntil.current = performance.now() + KEEP_AFTER_FOCUS_MS;
      }}
    >
      <TooltipTrigger
        delay={delay}
        closeDelay={200}
        isDisabled={isDisabled}
        isOpen={isOpen}
        onOpenChange={onOpenChange}
      >
        <Focusable>{children}</Focusable>
        <AriaTooltip
          className="wa-tooltip wa-inverse"
          offset={8}
          placement={placement}
          UNSTABLE_portalContainer={container}
        >
          {content}
        </AriaTooltip>
      </TooltipTrigger>
    </span>
  );
}
