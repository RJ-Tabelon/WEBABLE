'use client';

import { useId, type ReactNode } from 'react';
import { Button } from './Button';
import { cx } from './internal/cx';

export interface OfferBlockProps {
  /** The question: "Buttons on this page are small. Make them bigger here?" */
  question: ReactNode;
  /** The reason in plain words: "You tapped next to 3 buttons in the last minute." */
  reason?: ReactNode;
  onAccept: () => void;
  /** Snoozes this offer on this site for 7 days. */
  onDecline: () => void;
  /** Permanent for this site; editable in the app. Omit to hide the option. */
  onNeverHere?: () => void;
  acceptLabel?: string;
  declineLabel?: string;
  neverLabel?: string;
  className?: string;
}

/**
 * Offer block (design-final §7.17): the one contained surface in the popup.
 * [Try it] and [Not now] are equal in width and height, so declining costs the
 * same as accepting. Offers are never modal and never silent.
 */
export function OfferBlock({
  question,
  reason,
  onAccept,
  onDecline,
  onNeverHere,
  acceptLabel = 'Try it',
  declineLabel = 'Not now',
  neverLabel = "Don't suggest this here",
  className,
}: OfferBlockProps) {
  const uid = useId();
  const questionId = `${uid}-q`;
  const reasonId = reason ? `${uid}-r` : undefined;
  return (
    <section
      className={cx('wa-offer', className)}
      aria-labelledby={questionId}
      aria-describedby={reasonId}
    >
      <div className="wa-offer__inner">
        <p id={questionId} className="wa-offer__question">
          {question}
        </p>
        {reason ? (
          <p id={reasonId} className="wa-offer__reason">
            {reason}
          </p>
        ) : null}
        <div className="wa-offer__pair">
          <Button variant="primary" size="lg" onClick={onAccept}>
            {acceptLabel}
          </Button>
          <Button variant="secondary" size="lg" onClick={onDecline}>
            {declineLabel}
          </Button>
        </div>
        {onNeverHere ? (
          <Button
            variant="ghost"
            size="md"
            flush="start"
            className="wa-offer__never"
            onClick={onNeverHere}
          >
            {neverLabel}
          </Button>
        ) : null}
      </div>
    </section>
  );
}
