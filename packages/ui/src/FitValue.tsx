import { FitDigits, FitUnit } from './FitMark';
import { FitArrow } from './glyphs';
import { cx } from './internal/cx';

/** A number or a short Mono value ("18", "4.5:1", "1.6"). */
export type FitAmount = number | string;

/**
 * One value on "Your fit" (the shape `@webable/core` produces for each fit row).
 * Every kind carries `srText`, the whole phrase a screen reader hears
 * ("16 to 19 pixels"). Only real values: invented numbers are a bug.
 *
 * - `change`: before → after, both measured values ("16 → 19 px").
 * - `floor`: a minimum WebAble enforces ("At least 7:1").
 * - `word`: a setting in words ("Site colors → Dark").
 * - `same`: WebAble leaves this as the site made it.
 */
export type FitValue =
  | {
      kind: 'change';
      before: FitAmount;
      after: FitAmount;
      unit?: string;
      srText: string;
    }
  | { kind: 'floor'; after: FitAmount; unit?: string; srText: string }
  | { kind: 'word'; before?: string; after: string; srText: string }
  | { kind: 'same'; srText: string };

export type FitValueSize = 'readout' | 'inline';

export interface FitValueProps {
  value: FitValue;
  /** `readout` (Mono 28) on "Your fit"; `inline` (Mono 15) in lists. Default `readout`. */
  size?: FitValueSize;
  className?: string;
}

const SAME_TEXT = 'As the site made it';

/**
 * The value column of a fit row (design-final §7.20, §9.4).
 *
 * - `change`: Mono; before in secondary ink, the fit arrow, after in fern at
 *   540, the unit in WebAble Sans at 0.6em, 0.15em after the number. The
 *   readout is a grid (`6ch 1.5em 6ch`, before right-aligned, after and its
 *   unit left-aligned), so arrows line up down a column of rows.
 * - `floor`: "At least" in WebAble Sans 16 secondary ink, then the value in fern.
 * - `word`: WebAble Sans 20 / 540 (16 inline): before, arrow, after in fern.
 * - `same`: "As the site made it" in WebAble Sans 16 secondary ink.
 *
 * The drawing is `aria-hidden`; screen readers hear `value.srText`.
 */
export function FitValue({
  value,
  size = 'readout',
  className,
}: FitValueProps) {
  return (
    <span
      className={cx(
        'wa-fit-value',
        `wa-fit-value--${value.kind}`,
        `wa-fit-value--${size}`,
        className,
      )}
    >
      <span aria-hidden="true" className="wa-fit-value__visual">
        <FitVisual value={value} />
      </span>
      <span className="sr-only">{value.srText}</span>
    </span>
  );
}

function FitVisual({ value }: { value: FitValue }) {
  switch (value.kind) {
    case 'change':
      return (
        <>
          <span className="wa-fit-value__before">
            <FitDigits>{value.before}</FitDigits>
          </span>
          <span className="wa-fit-value__arrow">
            <FitArrow />
          </span>
          <span className="wa-fit-value__after">
            <span className="wa-fit-value__num">
              <FitDigits>{value.after}</FitDigits>
            </span>
            {value.unit ? <FitUnit unit={value.unit} /> : null}
          </span>
        </>
      );
    case 'floor':
      return (
        <>
          <span className="wa-fit-value__lead">At least</span>
          <span className="wa-fit-value__after">
            <span className="wa-fit-value__num">
              <FitDigits>{value.after}</FitDigits>
            </span>
            {value.unit ? <FitUnit unit={value.unit} /> : null}
          </span>
        </>
      );
    case 'word':
      return (
        <>
          {value.before !== undefined ? (
            <>
              <span className="wa-fit-value__before">{value.before}</span>
              <span className="wa-fit-value__arrow">
                <FitArrow />
              </span>
            </>
          ) : null}
          <span className="wa-fit-value__after">{value.after}</span>
        </>
      );
    case 'same':
      return <span className="wa-fit-value__same">{SAME_TEXT}</span>;
  }
}
