import { normCdf } from '../profile/needs';
import type { FitProfile, LatentDim } from '../profile/schema';
import { FIT_SOLVER_VERSION } from '../versions';
import {
  dimP,
  STRUCTURE_AUTO_P,
  STRUCTURE_OFFER_P,
  structureNeed,
} from './structure';
import { typeRamp } from './typeramp';
import type { FitLayout, FitStructure, GridClass } from './types';

/**
 * FitLayout solver: ability-parameterized rules from the fit
 * profile to Fit view's sizes, spacing, density and calm. Runs in the
 * service worker; the content script receives only the numbers.
 *
 * Every number comes from the person's fit: F (textMinPx) sets the type and
 * the spacing unit, the measured target size sets hit areas and gaps, the
 * attention latents set columns, inline navigation and what starts
 * collapsed. The decision space is small and discrete, so closed-form rules
 * replace SUPPLE's search; SUPPLE's active ingredient, control substitution,
 * lives in the renderer and proxies.
 *
 * Constants marked † are unvalidated defaults that the desktop study tunes.
 */

/** † Visual control height in multiples of F (text plus comfortable padding). */
export const FIT_CONTROL_EM = 2.2;
/**
 * Controls are never drawn shorter than 44 px, whatever F is: Apple's 44 pt
 * minimum and WCAG 2.5.5 (AAA) target size; the reference stores
 * draw 44-48 px pills around 16-17 px text.
 */
export const FIT_CONTROL_MIN_PX = 44;
/** Smallest visual gap between adjacent targets, in CSS px (WCAG 2.5.8's spacing intent). */
export const FIT_MIN_GAP_PX = 8;
/** At or above this F the person reads large print: the 8-character measure floor applies. */
export const FIT_LARGE_PRINT_PX = 24;
/** Minimum characters per line for 80% of maximum reading speed (Atılgan et al. 2020). */
export const FIT_MIN_LINE_CH_LOW_VISION = 8;
export const FIT_MIN_LINE_CH = 13;
/** † Spacing in multiples of F. */
export const FIT_UNIT_EM = 0.5;
export const FIT_GROUP_GAP_EM = 1.5;
export const FIT_SECTION_GAP_EM = 2.5;
export const FIT_CARD_PAD_EM = 0.75;
export const FIT_PAGE_PAD_EM = 1;
/** † Media card content width (video, product, image) in multiples of F; never below 220 px. */
export const FIT_CARD_MEDIA_EM = 11;
export const FIT_CARD_MEDIA_MIN_PX = 220;
/** † Text card content width in multiples of F (never below the media card floor). */
export const FIT_CARD_TEXT_EM = 16;
/** † Average character advance of the body face, in em (for the prose column width). */
export const FIT_CHAR_EM = 0.55;
/** † Grid columns grow up to this much past their minimum before another column fits. */
export const FIT_GRID_SLACK = 1.25;
/** † Records are grouped visually every N items (4 or 5 when chunking helps; Cowan 2001). */
export const FIT_GROUP_EVERY = 6;
/** † Records shown before "Show n more" when clutter or density hurts this person (strong / some). */
export const FIT_LIST_FIRST_STRONG = 8;
export const FIT_LIST_FIRST_SOME = 12;
/** † Paragraphs longer than this many sentences are split when chunking helps (strong / some). */
export const FIT_SPLIT_SENTENCES_STRONG = 3;
export const FIT_SPLIT_SENTENCES_SOME = 4;
/** † Inline navigation links: calm and default. */
export const FIT_NAV_INLINE_CALM = 5;
export const FIT_NAV_INLINE = 8;
/** Attention gates use the posterior P(benefit > 0), never the mean. */
export const FIT_GATE_P = 0.8;
/** † Middle band for column count. */
export const FIT_COLUMNS_MID_P = 0.5;

/** P(benefit > 0) = Φ(mean / sd) for one latent attention dimension. */
export function probBenefit(dim: LatentDim): number {
  const mean = Number.isFinite(dim.mean) ? dim.mean : 0;
  const sd = Number.isFinite(dim.sd) ? Math.max(dim.sd, 1e-6) : 1;
  if (mean === 0) return 0.5;
  return normCdf(mean / sd);
}

export interface FitEnvironment {
  /**
   * The system colour scheme. Fit view no longer follows it:
   * the OS setting is a taste, not a measured need, so only the fit's own
   * polarity turns the view dark. Kept so callers can still pass it.
   */
  colorScheme?: 'light' | 'dark';
}

const finite = (v: unknown, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;

/** Fit profile -> FitLayout. Pure and deterministic. */
export function solveFitLayout(
  profile: FitProfile,
  _env: FitEnvironment = {},
): FitLayout {
  const { vision, motor, attention } = profile;
  const F = Math.min(96, Math.max(12, finite(vision.textMinPx.value, 16)));
  const ramp = typeRamp(F, finite(vision.fontWeightFloor.value, 400));

  // Spacing: the profile's dials; letter spacing never outruns word spacing.
  const lineHeight = Math.min(
    2.2,
    Math.max(1.2, finite(vision.lineHeight.value, 1.5)),
  );
  const wordSpacingEm = Math.min(
    0.3,
    Math.max(0, finite(vision.wordSpacingEm.value, 0)),
  );
  const letterSpacingEm = Math.min(
    wordSpacingEm,
    Math.max(0, finite(vision.letterSpacingEm.value, 0)),
  );
  const maxLineCh = Math.round(
    Math.min(100, Math.max(45, finite(vision.maxLineCh.value, 80))),
  );
  const minLineCh =
    F >= FIT_LARGE_PRINT_PX ? FIT_MIN_LINE_CH_LOW_VISION : FIT_MIN_LINE_CH;

  // Targets: the measured size S*, not a fixed 44.
  const minPx = Math.max(1, finite(motor.minTargetPx.value, 24));
  const spacing = Math.max(0, finite(motor.targetSpacingPx.value, minPx));
  const controlPx = Math.max(
    minPx,
    FIT_CONTROL_MIN_PX,
    Math.round(F * FIT_CONTROL_EM),
  );
  const gapPx = Math.max(FIT_MIN_GAP_PX, spacing - minPx);

  // Space in multiples of F; groups at least twice the gap within a group.
  const unitPx = Math.max(4, Math.round(F * FIT_UNIT_EM));
  const itemGap = Math.max(unitPx, gapPx);
  const groupGapPx = Math.max(2 * itemGap, Math.round(F * FIT_GROUP_GAP_EM));
  const sectionGapPx = Math.max(
    Math.round(F * FIT_SECTION_GAP_EM),
    groupGapPx + unitPx,
  );
  const cardPadPx = Math.max(8, Math.round(F * FIT_CARD_PAD_EM));
  const pagePadPx = Math.max(16, Math.round(F * FIT_PAGE_PAD_EM));

  // Density and calm from the attention posteriors.
  const pDensity = probBenefit(attention.density);
  const pDistraction = probBenefit(attention.distraction);
  const pMotion = probBenefit(attention.motion);
  const maxCols =
    pDensity >= FIT_GATE_P ? 2 : pDensity >= FIT_COLUMNS_MID_P ? 3 : 4;
  const calm = pDistraction >= FIT_GATE_P;
  const structure = solveStructure(profile);

  const cardMedia = Math.max(
    FIT_CARD_MEDIA_MIN_PX,
    Math.round(F * FIT_CARD_MEDIA_EM + 2 * cardPadPx),
  );
  const cardText = Math.max(
    FIT_CARD_MEDIA_MIN_PX,
    Math.round(F * FIT_CARD_TEXT_EM + 2 * cardPadPx),
  );
  const grid: Record<GridClass, { minWidthPx: number; maxCols: number }> = {
    card_media: { minWidthPx: cardMedia, maxCols },
    card_text: { minWidthPx: cardText, maxCols },
    // Rows take the full width; below a text card's width a row stops reading as one line.
    row: { minWidthPx: cardText, maxCols: 1 },
  };
  const prosePx = Math.round(maxLineCh * FIT_CHAR_EM * F) + 2 * pagePadPx;
  const gridPx =
    Math.round(maxCols * cardMedia * FIT_GRID_SLACK) +
    (maxCols - 1) * itemGap +
    2 * pagePadPx;

  const polarity = vision.polarity.value;
  const contrastFloor = vision.contrastFloor.value;

  return {
    v: 1,
    version: FIT_SOLVER_VERSION,
    type: {
      ...ramp,
      lineHeight,
      wordSpacingEm,
      letterSpacingEm,
      maxLineCh,
      minLineCh,
      // The system UI face; Atkinson stays for a future
      // legibility setting.
      font: 'system',
    },
    target: { minPx, gapPx, controlPx },
    space: {
      unitPx,
      groupGapPx,
      sectionGapPx,
      cardPadPx,
      pagePadPx,
      maxContentPx: Math.max(prosePx, gridPx),
    },
    grid,
    groupEvery: structure.groupEvery,
    structure,
    nav: { inlineMax: calm ? FIT_NAV_INLINE_CALM : FIT_NAV_INLINE },
    tertiary: calm ? 'collapsed' : 'expanded',
    palette: {
      // Light unless the fit says dark (stated, or measured faster on dark).
      scheme: polarity === 'dark' ? 'dark' : 'light',
      contrast:
        contrastFloor === 21
          ? 'max'
          : contrastFloor === 7
            ? 'more'
            : 'standard',
    },
    motion:
      attention.systemReducedMotion || pMotion >= FIT_GATE_P
        ? 'reduce'
        : 'allow',
  };
}

/**
 * How far Fit view restructures, from Tune's Focus effects. The
 * content never changes; these decide how much of it shows at once, how it
 * is grouped and what orients the person:
 * - clutter (busy vs clean) or density: fewer records and sections open at
 *   once, the rest one labelled click away;
 * - chunking (dense vs chunked text): smaller record groups and shorter
 *   paragraphs, split only at sentence ends (segmenting, Rey 2019);
 * - guidance (weak vs strong hierarchy): an outline of long text (signaling,
 *   Schneider 2018).
 * Uninformed dimensions count as no benefit.
 */
export function solveStructure(profile: FitProfile): FitStructure {
  const need = structureNeed(profile);
  const clutter = Math.max(dimP(need, 'distraction'), dimP(need, 'density'));
  const chunking = dimP(need, 'chunking');
  const guidance = dimP(need, 'guidance');
  const band = (p: number): 0 | 1 | 2 =>
    p >= STRUCTURE_AUTO_P ? 2 : p >= STRUCTURE_OFFER_P ? 1 : 0;
  const c = band(clutter);
  const k = band(chunking);
  return {
    level: need.level,
    listFirst:
      c === 2 ? FIT_LIST_FIRST_STRONG : c === 1 ? FIT_LIST_FIRST_SOME : null,
    groupEvery: k === 2 ? 4 : k === 1 ? 5 : FIT_GROUP_EVERY,
    splitSentences:
      k === 2
        ? FIT_SPLIT_SENTENCES_STRONG
        : k === 1
          ? FIT_SPLIT_SENTENCES_SOME
          : null,
    outline: band(guidance) > 0 || need.level === 2,
    sectionsOpen: c === 2 ? 1 : c === 1 ? 2 : null,
  };
}
