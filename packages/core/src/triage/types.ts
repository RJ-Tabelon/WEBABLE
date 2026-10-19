import type { TRIAGE_VERSION } from '../versions';

/**
 * Triage: does this page need anything for this person, and how
 * much? Split so the fit never reaches the content script:
 *
 *   LayoutFeatures  person-independent numbers measured in the page
 *                   (PageSignals.layout, sent with cs:signals)
 *   TriageVerdict   person-relative decision computed in the service worker
 *                   from the features, PageSignals and the fit profile
 */
export interface LayoutFeatures {
  /** Character-weighted median px of main-region text (CSS px, before tab zoom); null when no text. */
  bodyPx: number | null;
  slack: {
    /** Smallest 1/U over nowrap or flex rows that hold text (U = children width / row width); null when none. */
    rowSlackMin: number | null;
    /** Share of in-view text area in boxes that clip (ellipsis, line-clamp, overflow hidden). */
    clipRiskShare: number;
    /** Share of in-view text area in fixed-height boxes. */
    fixedHeightTextShare: number;
    /** Share of in-view text area positioned over media. */
    overlayTextShare: number;
  };
  /** Share of the viewport covered by fixed or sticky boxes (0-1, clamped). */
  occlusion: number;
  density: {
    /** Visible leaf boxes per 100k px² of viewport. */
    leafPer100k: number;
    /** Distinct block top-left corners in view (visual complexity proxy). */
    corners: number;
    /** Distinct rounded font sizes in view. */
    fontSizes: number;
    /** Regions competing with main (v1 region list, excluding main and its ancestors). */
    regions: number;
  };
  records: {
    /** Collections of >= 5 similar items. */
    count: number;
    /** Items in the largest collection. */
    largest: number;
    /** Share of main's area covered by collections. */
    mainShare: number;
  };
  /** Mozilla isProbablyReaderable score (sum of sqrt(len - 140) over long paragraphs). */
  readerable: number;
  /**
   * Main reads as a document though its paragraphs are short (GOV.UK
   * guidance): a title, two or more section headings or lists, and at least
   * 600 characters. Absent from engines older than v2.1.
   */
  outlined?: boolean;
  kind: {
    product: boolean;
    editor: boolean;
    application: boolean;
    canvas: boolean;
    videoPlayer: boolean;
    paywall: boolean;
    /** A consent wall or modal that blocks the page is open. */
    blockingOverlay: boolean;
    password: boolean;
    payment: boolean;
  };
  /** The zoom guard's baseline. */
  nav: { primaryLinks: number; searchVisible: boolean };
}

export const TRIAGE_KINDS = ['fits', 'tailor', 'compose'] as const;
export type TriageKind = (typeof TRIAGE_KINDS)[number];

export const TRIAGE_NEEDS = [
  'text',
  'targets',
  'clutter',
  'occlusion',
  'contrast',
  'motion',
] as const;
export type TriageNeed = (typeof TRIAGE_NEEDS)[number];

/** Why Fit view cannot re-present this page. */
export const TRIAGE_BLOCKERS = [
  'editor',
  'application',
  'canvas',
  'video_player',
  'paywall',
  'blocking_overlay',
  'password',
  'payment',
  'no_structure',
] as const;
export type TriageBlocker = (typeof TRIAGE_BLOCKERS)[number];

/** Structured reasons; the popup's one-line explanation is rendered from these, never generated. */
export type TriageReason =
  | { kind: 'small_text'; k: number }
  | { kind: 'small_targets'; share: number; targetPx: number }
  | { kind: 'crowded_targets'; share: number }
  | { kind: 'busy'; percentile: number }
  | { kind: 'covered'; share: number }
  | { kind: 'low_contrast'; share: number }
  | { kind: 'motion'; count: number }
  /** The page cannot grow enough in place (k above the breakpoint-safe zoom, or no slack). */
  | { kind: 'cant_stretch'; k: number; zMax: number };

export interface TriageVerdict {
  version: typeof TRIAGE_VERSION;
  verdict: TriageKind;
  /** Needed scale textMinPx / (bodyPx x zoom); null when the page has no measurable text. */
  k: number | null;
  /** Page scale to apply (a Chrome preset, 1 = none). Frozen for the page view. */
  zoom: number;
  /** Largest breakpoint-safe zoom predicted for this page. */
  zMax: number;
  /** Text scale left for running text after zoom (k / zoom, >= 1). */
  residual: number;
  needs: Record<TriageNeed, TriageKind>;
  reasons: TriageReason[];
  /** Fit view can re-present this page (no blockers and enough structure). */
  representable: boolean;
  blockers: TriageBlocker[];
}
