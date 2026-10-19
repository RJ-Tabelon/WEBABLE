import type { FIT_SOLVER_VERSION } from '../versions';

/**
 * FitLayout: how big, how dense and how calm Fit view is for
 * one person. Computed from the fit profile in the service worker
 * (`fit/solver.ts`); the content script receives only these numbers, never
 * the profile.
 *
 * Every px value is a CSS px at 100% page zoom (the unit Tune measures in).
 * The renderer divides by the live zoom (tab zoom x pinch) when it draws.
 */
export interface TypeTier {
  px: number;
  weight: 400 | 500 | 600 | 700;
  /**
   * A non-size cue that carries the tier when sizes compress at large text:
   * extra space above, a rule line, or a tinted band.
   */
  cue: 'none' | 'space' | 'rule' | 'band';
}

export type GridClass = 'card_media' | 'card_text' | 'row';

export interface FitStructure {
  /** structureNeed(profile).level: 0 leave, 1 offer, 2 restructure automatically on busy pages. */
  level: 0 | 1 | 2;
  /**
   * Records shown in a list before "Show n more" (progressive disclosure,
   * COGA "avoid too much content"); null shows every record.
   */
  listFirst: number | null;
  /** A visible group break every N records (chunking; Cowan's ~4 chunks). */
  groupEvery: number;
  /**
   * Running-text paragraphs longer than this many sentences are shown as
   * shorter paragraphs, split only at sentence ends (segmenting; the words
   * do not change); null never splits.
   */
  splitSentences: number | null;
  /** "On this page" outline above long text with 3 or more headings (signaling). */
  outline: boolean;
  /**
   * Sections shown open below the primary one before "More on this page";
   * null opens them all (they still follow the primary section).
   */
  sectionsOpen: number | null;
}

export interface FitLayout {
  v: 1;
  version: typeof FIT_SOLVER_VERSION;
  type: {
    pageHeading: TypeTier;
    sectionHeading: TypeTier;
    title: TypeTier;
    body: TypeTier;
    meta: TypeTier;
    /** Unitless line height for running text. */
    lineHeight: number;
    wordSpacingEm: number;
    letterSpacingEm: number;
    /** Prose measure, in characters. */
    maxLineCh: number;
    /** Below this many characters per line, reduce columns (8 low vision, 13 otherwise). */
    minLineCh: number;
    /** The system UI face; Atkinson is kept for a future setting. */
    font: 'atkinson' | 'system';
  };
  target: {
    /** Minimum hit area side (the person's measured S*). */
    minPx: number;
    /** Gap between adjacent targets. */
    gapPx: number;
    /** Visual height of buttons, pills and inputs (>= minPx, follows the text). */
    controlPx: number;
  };
  space: {
    unitPx: number;
    groupGapPx: number;
    sectionGapPx: number;
    cardPadPx: number;
    pagePadPx: number;
    /** Widest content column. */
    maxContentPx: number;
  };
  /** Card and row sizing by grid class; columns = fit the width, capped at maxCols. */
  grid: Record<GridClass, { minWidthPx: number; maxCols: number }>;
  /** Records are grouped visually every N items (a larger gap). Equals structure.groupEvery. */
  groupEvery: number;
  /**
   * How far Fit view restructures the page for this person: the
   * content stays the same, the structure changes. Driven by Tune's Focus
   * effects (fit/structure.ts).
   */
  structure: FitStructure;
  nav: { inlineMax: number };
  tertiary: 'collapsed' | 'expanded';
  /** Dark only when the fit's polarity is dark, never from the OS alone. */
  palette: { scheme: 'light' | 'dark'; contrast: 'standard' | 'more' | 'max' };
  motion: 'reduce' | 'allow';
}
