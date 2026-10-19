'use client';

import type { AnchorHTMLAttributes, ReactNode, Ref } from 'react';
import { Icon } from './icons';
import { cx } from './internal/cx';
import { Anchor } from './internal/link';

export interface TextLinkProps extends Omit<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  'href'
> {
  href: string;
  children: ReactNode;
  /**
   * Opens in a new tab and shows a 16 px up-right arrow with "(opens in a new tab)"
   * for screen readers. Default: true for absolute http(s) URLs.
   */
  external?: boolean;
  /** `inline` (default) sits in running text; `standalone` adds a forward arrow. */
  kind?: 'inline' | 'standalone';
  ref?: Ref<HTMLAnchorElement>;
}

/**
 * Ink, underlined link (design-final §7.2). Links inside secondary text stay ink.
 * There is no disabled state: remove the link and say why instead.
 */
export function TextLink({
  href,
  children,
  external,
  kind = 'inline',
  className,
  target,
  rel,
  ref,
  ...rest
}: TextLinkProps) {
  const isExternal = external ?? /^https?:\/\//i.test(href);
  return (
    <Anchor
      {...rest}
      ref={ref}
      href={href}
      target={target ?? (isExternal ? '_blank' : undefined)}
      rel={rel ?? (isExternal ? 'noopener noreferrer' : undefined)}
      className={cx(
        'wa-link',
        kind === 'standalone' && 'wa-link--standalone',
        className,
      )}
    >
      {children}
      {isExternal ? (
        <>
          <Icon name="arrow-up-right" size={16} className="wa-link__icon" />
          <span className="sr-only"> (opens in a new tab)</span>
        </>
      ) : kind === 'standalone' ? (
        <Icon name="arrow-right" size={16} className="wa-link__icon" />
      ) : null}
    </Anchor>
  );
}
