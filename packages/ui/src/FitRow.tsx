import { useId, type ReactNode } from 'react';
import { FitValue, type FitValueSize } from './FitValue';
import { cx } from './internal/cx';

export interface FitRowProps {
  /** Row title ("Text size"). It is a heading, so rows can be browsed by heading. */
  label: ReactNode;
  /** Heading level for the label: 2 on Tune's "Your fit", 3 under an app section. */
  headingLevel: 2 | 3 | 4;
  /** One plain sentence in the design's voice ("Text reads best for you at 19 px or larger."). */
  sentence: ReactNode;
  /** Where the value came from ("Measured today", "Set by you"). Changed rows only. */
  source?: ReactNode;
  /** The value, as `@webable/core` describes it. */
  value: FitValue;
  /** The row's control, usually an [Adjust] ghost md button with `flush="end"`. */
  action?: ReactNode;
  /** Content that opens under the row across the full width (an editor, Keep new / Keep old). */
  editor?: ReactNode;
  /** `task` in Tune (task density), `working` in the app. */
  density: 'task' | 'working';
  /**
   * Whether WebAble changes pages for this row. Unchanged rows are compact
   * (56 min, 16 padding) and have no source line.
   */
  changed: boolean;
  /** Size of the value. Default `readout` (Mono 28). */
  size?: FitValueSize;
  /** Id for the label heading, e.g. for `aria-labelledby` on the editor. Generated when omitted. */
  labelId?: string;
  /** Element. Default `div`; use `li` inside a list. */
  as?: 'div' | 'li';
  className?: string;
}

/**
 * One row of "Your fit" (design-final §9.4), shared by Tune and the app.
 *
 * Grid: label, sentence and source | value | action; the editor spans the full
 * width below. Below a 48em row width the value and action move under the text.
 * The list around the rows draws the hairlines (`.wa-fitrows` does it for you).
 */
export function FitRow({
  label,
  headingLevel,
  sentence,
  source,
  value,
  action,
  editor,
  density,
  changed,
  size = 'readout',
  labelId,
  as: Root = 'div',
  className,
}: FitRowProps) {
  const uid = useId();
  const id = labelId ?? `${uid}-label`;
  const Heading = `h${headingLevel}` as const;
  return (
    <Root
      className={cx(
        'wa-fitrow',
        `wa-fitrow--${density}`,
        changed ? 'wa-fitrow--changed' : 'wa-fitrow--same',
        className,
      )}
    >
      <div className="wa-fitrow__main">
        <div className="wa-fitrow__text">
          <Heading id={id} className="wa-fitrow__label">
            {label}
          </Heading>
          <p className="wa-fitrow__sentence">{sentence}</p>
          {changed && source ? (
            <p className="wa-fitrow__source">{source}</p>
          ) : null}
        </div>
        <div className="wa-fitrow__value">
          <FitValue value={value} size={size} />
        </div>
        {action ? <div className="wa-fitrow__action">{action}</div> : null}
      </div>
      {editor ? <div className="wa-fitrow__editor">{editor}</div> : null}
    </Root>
  );
}
