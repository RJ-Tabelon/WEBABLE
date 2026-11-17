'use client';

import {
  isValidElement,
  useLayoutEffect,
  useRef,
  useState,
  type AnchorHTMLAttributes,
  type ButtonHTMLAttributes,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
  type Ref,
} from 'react';
import { Icon, type IconName, type IconSize } from './icons';
import { cx } from './internal/cx';
import { Anchor } from './internal/link';
import { mergeRefs } from './internal/refs';

export type ButtonVariant =
  'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-filled';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'task';

const ICON_SIZE: Record<ButtonSize, IconSize> = {
  sm: 16,
  md: 20,
  lg: 20,
  task: 24,
};

interface ButtonOwnProps {
  /**
   * `primary` is the one ink button per region. `secondary` (default) has a
   * line-strong edge. `ghost` is for tertiary and nav actions. `danger` is the
   * destructive outline; `danger-filled` is only for the final confirm in a modal.
   */
  variant?: ButtonVariant;
  /**
   * `lg` (48, default) almost everywhere; `md` (44) for nav, popup row actions,
   * toasts; `sm` (36 visual, 44 hit) for dense app tables only; `task` (64) for Tune.
   */
  size?: ButtonSize;
  /** Leading icon: an allowlisted icon name or a custom glyph element. */
  iconStart?: IconName | ReactElement;
  /** Trailing icon: an allowlisted icon name or a custom glyph element. */
  iconEnd?: IconName | ReactElement;
  /**
   * `forward` adds a trailing arrow (goes somewhere). `external` adds an up-right
   * arrow plus "(opens in a new tab)" for screen readers, and opens links in a new tab.
   */
  arrow?: 'forward' | 'external';
  /** Full width. Pairs inside `Actions` go full width below 30em on their own. */
  block?: boolean;
  /**
   * Pull a ghost button out by its own padding so its label, not its pill,
   * sits on the text edge: `start` for a button that begins a line (the offer's
   * "Don't suggest this here"), `end` for a row-end action ([Adjust], [Forget]).
   * The pill still shows on hover and press.
   */
  flush?: 'start' | 'end';
  /**
   * Work in progress: sets `aria-busy`, locks the current width, ignores clicks
   * and shows `busyLabel` (a gerund such as "Saving…"). No spinner.
   */
  busy?: boolean;
  busyLabel?: ReactNode;
  children: ReactNode;
}

export type ButtonAsButtonProps = ButtonOwnProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'disabled'> & {
    href?: undefined;
    /**
     * Never faded: renders `aria-disabled`, keeps focus so the reason can be read,
     * swallows clicks. Link the reason line with `aria-describedby`.
     */
    disabled?: boolean;
    ref?: Ref<HTMLButtonElement>;
  };

export type ButtonAsLinkProps = ButtonOwnProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'children' | 'href'> & {
    /** Renders an anchor styled as a button (internal paths use the router link). */
    href: string;
    ref?: Ref<HTMLAnchorElement>;
  };

export type ButtonProps = ButtonAsButtonProps | ButtonAsLinkProps;

function renderIcon(icon: IconName | ReactElement | undefined, size: IconSize) {
  if (!icon) return null;
  if (isValidElement(icon)) return icon;
  return <Icon name={icon as IconName} size={size} />;
}

/** Pill button (design-final §7.1). Renders a `<button>`, or an `<a>` when `href` is set. */
export function Button(props: ButtonProps) {
  const {
    variant = 'secondary',
    size = 'lg',
    iconStart,
    iconEnd,
    arrow,
    block = false,
    flush,
    busy = false,
    busyLabel,
    children,
    className,
    style,
  } = props;

  const elementRef = useRef<HTMLElement | null>(null);
  const [lockedWidth, setLockedWidth] = useState<number | null>(null);

  // Lock the width the moment the button becomes busy, so the gerund label never
  // changes the layout around it.
  useLayoutEffect(() => {
    if (busy && elementRef.current) {
      setLockedWidth(elementRef.current.getBoundingClientRect().width);
    } else if (!busy) {
      setLockedWidth(null);
    }
  }, [busy]);

  const iconSize = ICON_SIZE[size];
  const content = (
    <>
      {renderIcon(iconStart, iconSize)}
      <span className="wa-btn__label">
        {busy && busyLabel ? busyLabel : children}
      </span>
      {renderIcon(iconEnd, iconSize)}
      {arrow === 'forward' ? (
        <Icon name="arrow-right" size={size === 'task' ? 24 : 20} />
      ) : null}
      {arrow === 'external' ? (
        <>
          <Icon name="arrow-up-right" size={16} />
          <span className="sr-only"> (opens in a new tab)</span>
        </>
      ) : null}
    </>
  );

  const classes = cx(
    'wa-btn',
    `wa-btn--${variant}`,
    `wa-btn--${size}`,
    block && 'wa-btn--block',
    flush && `wa-btn--flush-${flush}`,
    className,
  );
  const mergedStyle = lockedWidth
    ? { ...style, minWidth: `${lockedWidth}px` }
    : style;

  if (props.href !== undefined) {
    const {
      variant: _v,
      size: _s,
      iconStart: _is,
      iconEnd: _ie,
      arrow: _a,
      block: _b,
      flush: _f,
      busy: _busy,
      busyLabel: _bl,
      children: _c,
      className: _cn,
      style: _st,
      ref,
      href,
      target,
      rel,
      onClick,
      ...rest
    } = props;
    const external = arrow === 'external';
    return (
      <Anchor
        {...rest}
        href={href}
        target={target ?? (external ? '_blank' : undefined)}
        rel={rel ?? (external ? 'noopener noreferrer' : undefined)}
        ref={mergeRefs(ref, elementRef as Ref<HTMLAnchorElement>)}
        className={classes}
        style={mergedStyle}
        aria-busy={busy || undefined}
        onClick={(event: MouseEvent<HTMLAnchorElement>) => {
          if (busy) {
            event.preventDefault();
            return;
          }
          onClick?.(event);
        }}
      >
        {content}
      </Anchor>
    );
  }

  const {
    variant: _v,
    size: _s,
    iconStart: _is,
    iconEnd: _ie,
    arrow: _a,
    block: _b,
    flush: _f,
    busy: _busy,
    busyLabel: _bl,
    children: _c,
    className: _cn,
    style: _st,
    ref,
    disabled = false,
    type = 'button',
    onClick,
    ...rest
  } = props;
  const inert = disabled || busy;
  return (
    <button
      {...rest}
      ref={mergeRefs(ref, elementRef as Ref<HTMLButtonElement>)}
      type={type}
      className={classes}
      style={mergedStyle}
      aria-disabled={disabled || undefined}
      aria-busy={busy || undefined}
      onClick={(event: MouseEvent<HTMLButtonElement>) => {
        if (inert) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
    >
      {content}
    </button>
  );
}

export interface ActionsProps {
  children: ReactNode;
  /**
   * `equal` gives every button the same width (offer pairs: declining costs the same
   * as accepting). Default `natural`.
   */
  sizing?: 'natural' | 'equal';
  className?: string;
}

/**
 * A row of buttons: primary first, left-aligned, 12 px apart (8 in compact
 * surfaces). Stacks full width below 30em, or below 340 px when inside a
 * container such as the popup.
 */
export function Actions({
  children,
  sizing = 'natural',
  className,
}: ActionsProps) {
  return (
    <div
      className={cx(
        'wa-actions',
        sizing === 'equal' && 'wa-actions--equal',
        className,
      )}
    >
      {children}
    </div>
  );
}
