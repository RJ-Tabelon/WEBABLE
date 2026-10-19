import type { ReactNode } from 'react';
import { Disclosure } from './Disclosure';
import { Mark } from './glyphs';
import { Icon } from './icons';
import { cx } from './internal/cx';

export interface EmptyStateProps {
  /** Five words or fewer (20 / medium): "No sites yet." */
  title: ReactNode;
  /** One sentence: "Sites where you change settings show up here." */
  children: ReactNode;
  /** One action. */
  action?: ReactNode;
  /** `page` (body 18) or `compact` (16, popup). */
  density?: 'page' | 'compact';
  /** Title element. Default `h2`. */
  as?: 'h2' | 'h3' | 'p';
  className?: string;
}

/** Empty state (design-final §7.18): a 48 px mark in line-strong, a title, one sentence, one action. */
export function EmptyState({
  title,
  children,
  action,
  density = 'page',
  as: Title = 'h2',
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cx(
        'wa-empty',
        density === 'compact' && 'wa-empty--compact',
        className,
      )}
    >
      <Mark size={48} className="wa-empty__mark" />
      <Title className="wa-empty__title">{title}</Title>
      <p className="wa-empty__text">{children}</p>
      {action ? <div className="wa-empty__action">{action}</div> : null}
    </div>
  );
}

export interface ErrorPanelProps {
  /** What happened, in a few words (18 / medium). Never blame the person. */
  title: ReactNode;
  /** What happened · what is safe · what to do (16, ink). */
  children: ReactNode;
  /** One secondary action. */
  action?: ReactNode;
  /** Codes and technical detail, behind a "Details" disclosure. */
  details?: ReactNode;
  /** Announce immediately (`role="alert"`) when the panel appears after an action. */
  live?: boolean;
  /** Title element. Default `h2`. */
  as?: 'h2' | 'h3' | 'p';
  className?: string;
}

/**
 * Error panel (design-final §7.18): danger tint, radius 12, a triangle glyph.
 * A verifier rollback is not an error: show it as a neutral "undone" row instead.
 */
export function ErrorPanel({
  title,
  children,
  action,
  details,
  live = false,
  as: Title = 'h2',
  className,
}: ErrorPanelProps) {
  return (
    <div
      className={cx('wa-error', className)}
      role={live ? 'alert' : undefined}
    >
      <Icon name="triangle-alert" size={20} className="wa-error__icon" />
      <div className="wa-error__content">
        <Title className="wa-error__title">{title}</Title>
        <div className="wa-error__text">{children}</div>
        {action ? <div className="wa-error__action">{action}</div> : null}
        {details ? (
          <Disclosure
            title="Details"
            density="compact"
            headingLevel={null}
            className="wa-error__details"
          >
            {details}
          </Disclosure>
        ) : null}
      </div>
    </div>
  );
}

export interface KbdProps {
  children: ReactNode;
  className?: string;
}

/** Keyboard hint (design-final §7.19): Mono 15 on tonal, 1 px hairline, radius 4. */
export function Kbd({ children, className }: KbdProps) {
  return <kbd className={cx('wa-kbd', className)}>{children}</kbd>;
}

export interface VisuallyHiddenProps {
  children: ReactNode;
}

/** Text for screen readers only. */
export function VisuallyHidden({ children }: VisuallyHiddenProps) {
  return <span className="sr-only">{children}</span>;
}
