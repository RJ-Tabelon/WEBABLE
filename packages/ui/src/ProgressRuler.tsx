import type { CSSProperties } from 'react';
import { cx } from './internal/cx';

export interface RulerSection {
  id: string;
  /** Named by activity, never by condition: "Reading", "Pointing", "Focus". */
  label: string;
  /** Number of tasks; sections are drawn proportional to it. */
  tasks: number;
}

export interface ProgressRulerProps {
  sections: ReadonlyArray<RulerSection>;
  /** Index of the current section. `sections.length` means every section is done. */
  current: number;
  /** Tasks finished inside the current section (0 to its task count). */
  taskIndex: number;
  /** Accessible name of the step list. Default "Tune progress". */
  label?: string;
  className?: string;
}

interface Geometry {
  starts: number[];
  ends: number[];
  position: number;
  subTicks: Array<{ at: number; done: boolean }>;
}

/** Pure geometry for the ruler, as fractions of its width. Exported for tests. */
export function rulerGeometry(
  sections: ReadonlyArray<RulerSection>,
  current: number,
  taskIndex: number,
): Geometry {
  const total = sections.reduce((sum, s) => sum + Math.max(0, s.tasks), 0) || 1;
  const starts: number[] = [];
  const ends: number[] = [];
  let acc = 0;
  for (const s of sections) {
    starts.push(acc / total);
    acc += Math.max(0, s.tasks);
    ends.push(acc / total);
  }
  const clampedCurrent = Math.min(Math.max(current, 0), sections.length);
  const section = sections[clampedCurrent];
  const before = starts[clampedCurrent] ?? 1;
  const inSection = section
    ? Math.min(Math.max(taskIndex, 0), section.tasks)
    : 0;
  const position = Math.min(1, before + inSection / total);
  const subTicks: Geometry['subTicks'] = [];
  if (section) {
    for (let k = 1; k < section.tasks; k += 1) {
      const at = before + k / total;
      subTicks.push({ at, done: at <= position + 1e-9 });
    }
  }
  return { starts, ends, position, subTicks };
}

const pct = (fraction: number) => `${(fraction * 100).toFixed(3)}%`;

/**
 * The calibration progress ruler (design-final §9.3): the fit mark stretched into a
 * track. Done is a 2 px ink line; upcoming is 1 px line-strong; the current section
 * shows one sub-tick per task and a 12 px ink dot. The graphic is `aria-hidden`; an
 * ordered list with `aria-current="step"` backs it. It is never accent and never
 * animates: calibration measures, it does not change the page.
 */
export function ProgressRuler({
  sections,
  current,
  taskIndex,
  label = 'Tune progress',
  className,
}: ProgressRulerProps) {
  const { starts, ends, position, subTicks } = rulerGeometry(
    sections,
    current,
    taskIndex,
  );
  const boundaries = [...starts, 1];
  return (
    <div className={cx('wa-ruler', className)}>
      <svg
        className="wa-ruler__graphic"
        height="24"
        aria-hidden="true"
        focusable="false"
      >
        <line
          className="wa-ruler__upcoming"
          x1={pct(position)}
          x2="100%"
          y1="12"
          y2="12"
        />
        {position > 0 ? (
          <line
            className="wa-ruler__done"
            x1="0"
            x2={pct(position)}
            y1="12"
            y2="12"
          />
        ) : null}
        {boundaries.map((at, i) => (
          <line
            key={`b${i}`}
            className={
              at <= position + 1e-9
                ? 'wa-ruler__tick wa-ruler__tick--done'
                : 'wa-ruler__tick'
            }
            x1={pct(at)}
            x2={pct(at)}
            y1="6"
            y2="18"
          />
        ))}
        {subTicks.map((tick, i) => (
          <line
            key={`s${i}`}
            className={
              tick.done ? 'wa-ruler__sub wa-ruler__sub--done' : 'wa-ruler__sub'
            }
            x1={pct(tick.at)}
            x2={pct(tick.at)}
            y1="9"
            y2="15"
          />
        ))}
        {current < sections.length ? (
          <circle className="wa-ruler__dot" cx={pct(position)} cy="12" r="6" />
        ) : null}
      </svg>
      <ol className="wa-ruler__steps" aria-label={label}>
        {sections.map((section, i) => {
          const mid = ((starts[i] ?? 0) + (ends[i] ?? 0)) / 2;
          const style = { '--_at': pct(mid) } as CSSProperties;
          const state =
            i < current ? 'done' : i === current ? 'current' : 'upcoming';
          return (
            <li
              key={section.id}
              className={cx('wa-ruler__step', `wa-ruler__step--${state}`)}
              aria-current={state === 'current' ? 'step' : undefined}
              style={style}
            >
              {section.label}
              {state === 'done' ? (
                <span className="sr-only">, done</span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
