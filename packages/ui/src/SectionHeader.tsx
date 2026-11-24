import type { ReactNode } from 'react';
import { cx } from './internal/cx';
import { TextLink } from './TextLink';

export interface SectionHeaderProps {
  /** A fact, not a category: "3 short tasks · about 6 min". Meta 15 / medium. */
  eyebrow?: ReactNode;
  /** The heading, at most two lines. */
  title: ReactNode;
  /** One or two lines of body 18 in secondary ink, within the reading measure. */
  deck?: ReactNode;
  /** Optional link on the eyebrow's baseline, aligned right. */
  link?: { href: string; label: ReactNode };
  /** Heading element. Default `h2`. */
  as?: 'h1' | 'h2' | 'h3';
  /** Id for the heading, for `aria-labelledby` on the section. */
  titleId?: string;
  className?: string;
}

/**
 * Section header with the index rule (design-final §7.11): a hairline whose first
 * 24 px is a 2 px ink segment (the fit mark's tick), then eyebrow, heading and deck.
 * Left-aligned on the page's one text edge. The optional link sits on the
 * eyebrow's baseline at 48em and wider, and after the deck below that.
 */
export function SectionHeader({
  eyebrow,
  title,
  deck,
  link,
  as: Heading = 'h2',
  titleId,
  className,
}: SectionHeaderProps) {
  return (
    <header
      className={cx(
        'wa-section-head',
        `wa-section-head--${Heading}`,
        link && 'wa-section-head--link',
        className,
      )}
    >
      <IndexRule />
      {eyebrow ? <p className="wa-section-head__eyebrow">{eyebrow}</p> : null}
      <Heading id={titleId} className="wa-section-head__title">
        {title}
      </Heading>
      {deck ? <p className="wa-section-head__deck">{deck}</p> : null}
      {/* Last in the source, so the reading order is eyebrow, title, deck, link.
          At 48em and wider it is placed on the eyebrow's baseline. */}
      {link ? (
        <TextLink
          href={link.href}
          kind="standalone"
          className="wa-section-head__link"
        >
          {link.label}
        </TextLink>
      ) : null}
    </header>
  );
}

/** The index rule on its own: a 1 px hairline with a 24 px, 2 px ink lead. */
export function IndexRule({ className }: { className?: string }) {
  return <span className={cx('wa-index-rule', className)} aria-hidden="true" />;
}
