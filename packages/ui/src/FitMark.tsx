import { Fragment, type CSSProperties, type ReactNode } from 'react';
import { FitArrow } from './glyphs';
import { cx } from './internal/cx';

const SPOKEN_UNITS: Record<string, string> = {
  px: 'pixels',
  '%': 'percent',
  ms: 'milliseconds',
  s: 'seconds',
  em: 'em',
  min: 'minutes',
};

/** Speaks a unit in words for screen readers ("px" becomes "pixels"). */
export function spokenUnit(unit: string | undefined): string {
  if (!unit) return '';
  return SPOKEN_UNITS[unit] ?? unit;
}

/**
 * A Mono number with its "." and ":" pulled in (margin-inline −0.16em), so
 * "4.5:1" reads as one value instead of five evenly spaced cells.
 */
export function FitDigits({ children }: { children: string | number }) {
  const parts = String(children).split(/([.:])/);
  return (
    <>
      {parts.map((part, i) =>
        part === '.' || part === ':' ? (
          <span key={i} className="wa-fit-punct">
            {part}
          </span>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}

/**
 * The unit after a value: WebAble Sans at 0.6em (never under the 15 px floor),
 * 0.15em after the number. No no-break-space glyph, so there is never a
 * double gap in Mono.
 */
export function FitUnit({
  unit,
  className,
}: {
  unit: string;
  className?: string;
}) {
  return <span className={cx('wa-fit-unit', className)}>{unit}</span>;
}

export interface FitMarkValue {
  /** The value before WebAble changed it. Omit for a single after-value ("2 paused"). */
  from?: number | string;
  /** The value now. Only real values: a fit mark with invented numbers is a bug. */
  to: number | string;
  /** Unit after the value ("px"), set 0.15em after the number. */
  unit?: string;
  /** Spoken unit. Default derived from `unit` ("px" to "pixels"). */
  unitSpoken?: string;
}

function spokenValue({ from, to, unit, unitSpoken }: FitMarkValue): string {
  const u = unitSpoken ?? spokenUnit(unit);
  const tail = u ? ` ${u}` : '';
  return from === undefined ? `${to}${tail}` : `${from} to ${to}${tail}`;
}

export interface FitMarkProps extends FitMarkValue {
  /** Row label (16 / medium), for example "Text size". */
  label?: ReactNode;
  /** `inline` (Mono 15) for lists and popup rows; `readout` (Mono 28) for Your fit. */
  size?: 'inline' | 'readout';
  className?: string;
}

/** The visible value: before, fit arrow, after and unit. Decorative; pair with sr text. */
function FitVisual({
  from,
  to,
  unit,
  className,
}: FitMarkValue & { className: string }) {
  return (
    <span aria-hidden="true" className={className}>
      {from !== undefined ? (
        <>
          <span className="wa-fit-mark__from">
            <FitDigits>{from}</FitDigits>
          </span>
          <FitArrow />
        </>
      ) : null}
      <span className="wa-fit-mark__after">
        <span className="wa-fit-mark__to">
          <FitDigits>{to}</FitDigits>
        </span>
        {unit ? <FitUnit unit={unit} className="wa-fit-mark__unit" /> : null}
      </span>
    </span>
  );
}

/**
 * Fit mark, component form (design-final §7.20): the before value in secondary
 * ink, the SVG fit arrow, the after value in fern at 540, then the unit.
 * Screen readers hear "13 to 18 pixels". For "Your fit" rows use `FitValue`,
 * which also covers floors, words and unchanged values.
 */
export function FitMark({
  label,
  size = 'inline',
  className,
  ...value
}: FitMarkProps) {
  return (
    <span
      className={cx(
        'wa-fit-mark',
        size === 'readout' && 'wa-fit-mark--readout',
        className,
      )}
    >
      {label ? <span className="wa-fit-mark__label">{label}</span> : null}
      <span className="wa-fit-mark__value">
        <FitVisual {...value} className="wa-fit-mark__visual" />
        <span className="sr-only">{spokenValue(value)}</span>
      </span>
    </span>
  );
}

export interface FitMarkBlockProps extends FitMarkValue {
  /** What was measured, for the accessible name ("Text size"). */
  label: string;
  /** Put the value on a radius-4 canvas plate, for use over imagery. */
  plate?: boolean;
  /**
   * Draw the line once (`--dur-draw`, then a 100 ms label fade). Website hero only,
   * once per session; static under reduced motion.
   */
  draw?: boolean;
  className?: string;
  style?: CSSProperties;
}

/**
 * Block fit mark (annotations on captures): a 1 px dimension line with 1 x 8 end
 * ticks and the value centred above it in Mono 15. It spans its container's width.
 */
export function FitMarkBlock({
  label,
  plate = false,
  draw = false,
  className,
  style,
  ...value
}: FitMarkBlockProps) {
  return (
    <span
      role="img"
      aria-label={`${label}: ${spokenValue(value)}`}
      className={cx(
        'wa-fit-block',
        plate && 'wa-fit-block--plate',
        draw && 'wa-fit-block--draw',
        className,
      )}
      style={style}
    >
      <FitVisual {...value} className="wa-fit-block__value" />
      <span className="wa-fit-block__line" aria-hidden="true" />
    </span>
  );
}
