import type { TypeTier } from './types';

/**
 * Fit view's type ramp: body text at the person's floor F and
 * every other tier as a ratio of F that compresses as F grows, the way iOS
 * Dynamic Type and Android 14's non-linear font scaling keep hierarchy at
 * large sizes without running out of screen (product practice, not
 * experiments). Hierarchy comes from size, not weight: the
 * three heading tiers are 600 and body is 400 (the Apple and Google Store
 * ramps). When sizes alone stop separating adjacent tiers,
 * weight or a structural cue carries the tier.
 *
 * Constants marked † are unvalidated defaults that the desktop study tunes.
 */

export type TierName = 'pageHeading' | 'sectionHeading' | 'title';

/**
 * † Ratios to F at four body sizes, held outside the first
 * and last. At 16 px the page heading is 40 px (the reference stores' tile
 * headline band); at 40 px and above the ratios compress to about Apple's
 * accessibility sizes.
 */
export const FIT_RAMP_ANCHORS: ReadonlyArray<
  Readonly<{ F: number; ratios: Readonly<Record<TierName, number>> }>
> = [
  { F: 16, ratios: { pageHeading: 2.5, sectionHeading: 1.75, title: 1.25 } },
  { F: 24, ratios: { pageHeading: 2.0, sectionHeading: 1.5, title: 1.17 } },
  { F: 32, ratios: { pageHeading: 1.6, sectionHeading: 1.3, title: 1.12 } },
  { F: 40, ratios: { pageHeading: 1.35, sectionHeading: 1.18, title: 1.08 } },
];

/** † Metadata is spot-reading text: 0.85 F, never below 14 px, never above body. */
export const FIT_META_RATIO = 0.85;
export const FIT_META_MIN_PX = 14;

/** † Adjacent tiers read as different at 1.15x size or 200 weight units apart. */
export const FIT_DISTINCT_SIZE_RATIO = 1.15;
export const FIT_DISTINCT_WEIGHT_STEP = 200;

/** Weight cap: heavier strokes close counters at large sizes (cal-vision). */
export const FIT_MAX_WEIGHT = 700;
/** † Default weights: every heading tier semibold, body regular. */
export const FIT_HEADING_WEIGHT = 600;
export const FIT_TITLE_WEIGHT = 600;

/** Which cue carries a tier whose size and weight do not separate it from the next. */
const CUE: Readonly<Record<TierName, TypeTier['cue']>> = {
  pageHeading: 'band',
  sectionHeading: 'rule',
  title: 'space',
};

const WEIGHTS: readonly TypeTier['weight'][] = [400, 500, 600, 700];

function toWeight(w: number): TypeTier['weight'] {
  const capped = Math.min(FIT_MAX_WEIGHT, Math.max(400, w));
  let best: TypeTier['weight'] = 400;
  for (const v of WEIGHTS) if (v <= capped) best = v;
  return best;
}

/**
 * Tier ratios for body size F: log-linear between neighbouring anchors, so
 * the ratios fall smoothly, keep their order and F x ratio never shrinks.
 */
export function rampRatios(F: number): Record<TierName, number> {
  const first = FIT_RAMP_ANCHORS[0]!;
  const last = FIT_RAMP_ANCHORS[FIT_RAMP_ANCHORS.length - 1]!;
  const f = Number.isFinite(F) ? F : first.F;
  if (f <= first.F) return { ...first.ratios };
  if (f >= last.F) return { ...last.ratios };
  let lo = first;
  let hi = last;
  for (let i = 0; i + 1 < FIT_RAMP_ANCHORS.length; i++) {
    const a = FIT_RAMP_ANCHORS[i]!;
    const b = FIT_RAMP_ANCHORS[i + 1]!;
    if (f >= a.F && f <= b.F) {
      lo = a;
      hi = b;
      break;
    }
  }
  const t = (Math.log(f) - Math.log(lo.F)) / (Math.log(hi.F) - Math.log(lo.F));
  const mix = (name: TierName): number =>
    Math.exp(
      Math.log(lo.ratios[name]) +
        (Math.log(hi.ratios[name]) - Math.log(lo.ratios[name])) * t,
    );
  return {
    pageHeading: mix('pageHeading'),
    sectionHeading: mix('sectionHeading'),
    title: mix('title'),
  };
}

/** Do two adjacent tiers read as different (size, weight, or a cue on the upper one)? */
export function tiersDistinguishable(
  upper: TypeTier,
  lower: TypeTier,
): boolean {
  return (
    upper.px >= lower.px * FIT_DISTINCT_SIZE_RATIO - 1e-9 ||
    upper.weight - lower.weight >= FIT_DISTINCT_WEIGHT_STEP ||
    upper.cue !== 'none'
  );
}

export interface TypeRamp {
  pageHeading: TypeTier;
  sectionHeading: TypeTier;
  title: TypeTier;
  body: TypeTier;
  meta: TypeTier;
}

const round2 = (x: number): number => Math.round(x * 100) / 100;

/**
 * The five tiers for body size F (the person's textMinPx) and their weight
 * floor. Sizes strictly decrease from page heading to body; meta sits at or
 * below body. Weights respect the floor and the 700 cap. Each heading tier
 * that size and weight cannot separate from the tier below gets a cue.
 */
export function typeRamp(F: number, weightFloor: number): TypeRamp {
  const body = round2(F);
  const floor = toWeight(weightFloor);
  const ratios = rampRatios(F);
  const title = Math.max(Math.round(F * ratios.title), Math.floor(body) + 1);
  const section = Math.max(Math.round(F * ratios.sectionHeading), title + 1);
  const page = Math.max(Math.round(F * ratios.pageHeading), section + 1);
  const meta = Math.min(
    body,
    Math.round(Math.max(F * FIT_META_RATIO, FIT_META_MIN_PX) * 2) / 2,
  );

  const tiers: TypeRamp = {
    pageHeading: {
      px: page,
      weight: toWeight(Math.max(FIT_HEADING_WEIGHT, floor)),
      cue: 'none',
    },
    sectionHeading: {
      px: section,
      weight: toWeight(Math.max(FIT_HEADING_WEIGHT, floor)),
      cue: 'none',
    },
    title: {
      px: title,
      weight: toWeight(Math.max(FIT_TITLE_WEIGHT, floor)),
      cue: 'none',
    },
    body: { px: body, weight: floor, cue: 'none' },
    meta: { px: meta, weight: floor, cue: 'none' },
  };

  // Bottom-up: weight first (it costs no space), then a structural cue.
  const pairs: Array<[TierName, keyof TypeRamp]> = [
    ['title', 'body'],
    ['sectionHeading', 'title'],
    ['pageHeading', 'sectionHeading'],
  ];
  for (const [upperName, lowerName] of pairs) {
    const upper = tiers[upperName];
    const lower = tiers[lowerName];
    if (tiersDistinguishable(upper, lower)) continue;
    const heavier = lower.weight + FIT_DISTINCT_WEIGHT_STEP;
    if (heavier <= FIT_MAX_WEIGHT && heavier > upper.weight) {
      upper.weight = toWeight(heavier);
      if (tiersDistinguishable(upper, lower)) continue;
    }
    upper.cue = CUE[upperName];
  }
  return tiers;
}
