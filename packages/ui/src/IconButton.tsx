'use client';

import {
  isValidElement,
  type ButtonHTMLAttributes,
  type MouseEvent,
  type ReactElement,
  type Ref,
} from 'react';
import { Icon, type IconName } from './icons';
import { cx } from './internal/cx';
import { Tooltip, type TooltipPlacement } from './Tooltip';

export interface IconButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'children' | 'aria-label' | 'disabled'
> {
  /** An allowlisted icon name or a custom glyph element (20 px). */
  icon: IconName | ReactElement;
  /** Accessible name, also shown as the tooltip. Required: icon buttons have no visible label. */
  label: string;
  /**
   * `ghost` (default): transparent circle. `secondary`: line-strong edge (slider
   * steppers). `inverse`: for use on inverse surfaces such as the toast.
   */
  variant?: 'ghost' | 'secondary' | 'inverse';
  /** `md` 44 x 44 (default) or `lg` 48 x 48 (site Menu and Close). */
  size?: 'md' | 'lg';
  /** Show the label as a tooltip on hover and keyboard focus. Default true. */
  tooltip?: boolean;
  tooltipPlacement?: TooltipPlacement;
  /** Never faded: `aria-disabled`, focusable, clicks ignored. */
  disabled?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

/** Circular icon-only button with a required label (design-final §7.1). */
export function IconButton({
  icon,
  label,
  variant = 'ghost',
  size = 'md',
  tooltip = true,
  tooltipPlacement = 'top',
  disabled = false,
  className,
  type = 'button',
  onClick,
  ref,
  ...rest
}: IconButtonProps) {
  const button = (
    <button
      {...rest}
      ref={ref}
      type={type}
      aria-label={label}
      aria-disabled={disabled || undefined}
      className={cx(
        'wa-icon-btn',
        `wa-icon-btn--${variant}`,
        `wa-icon-btn--${size}`,
        className,
      )}
      onClick={(event: MouseEvent<HTMLButtonElement>) => {
        if (disabled) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
    >
      {isValidElement(icon) ? icon : <Icon name={icon as IconName} size={20} />}
    </button>
  );
  if (!tooltip) return button;
  return (
    <Tooltip content={label} placement={tooltipPlacement}>
      {button}
    </Tooltip>
  );
}
