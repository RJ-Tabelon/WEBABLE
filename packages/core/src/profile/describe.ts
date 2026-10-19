import { OP_LABELS } from '../explain/glossary';
import { benefitProbability, needLevels } from './needs';
import type { FitProfile, LatentDim, ParamSource } from './schema';

/**
 * Plain-language rows for the "Your fit" screen and
 * the CSS hooks WebAble's own UI reads (tokens.css `--wa-*`).
 *
 * Copy rules: calm, exact, short; digits with units and a
 * no-break space; functions and pages, never people or conditions; no exam
 * language. Every value shown here is a real profile value.
 */

export type FitRowId =
  | 'textSize'
  | 'contrast'
  | 'polarity'
  | 'lineSpacing'
  | 'lineLength'
  | 'targets'
  | 'steadyClicks'
  | 'hoverGrace'
  | 'motion'
  | 'busyPages';

export type ConfidenceLabel = 'high' | 'medium' | 'low';

/** Where a value came from; `answered` is a Tune question rather than a measurement. */
export type SourceKind = ParamSource | 'answered';

/** A number or a short Mono value ("19", "7:1", "1.8"). */
export type FitRowAmount = number | string;

/**
 * One row's value, in the shape `@webable/ui`'s FitValue draws. Only real
 * values: a `change` has a known before (the browser's text size, or the
 * previous fit); a minimum WebAble enforces is a `floor`; settings in words
 * are `word`; rows WebAble leaves alone are `same`.
 */
export type FitRowValue =
  | {
      kind: 'change';
      before: FitRowAmount;
      after: FitRowAmount;
      unit?: string;
      srText: string;
    }
  | { kind: 'floor'; after: FitRowAmount; unit?: string; srText: string }
  | { kind: 'word'; before?: string; after: string; srText: string }
  | { kind: 'same'; srText: string };

export interface FitRow {
  id: FitRowId;
  label: string;
  /** What the row shows: this fit against pages as sites made them, or the recalibration change. */
  value: FitRowValue;
  /**
   * The browser's text size, the site's own setting in words, "As the site
   * made it", or the previous fit when recalibrating. Kept for older readers;
   * prefer `value`.
   */
  before: string;
  /** This fit. */
  after: string;
  /** Screen-reader form of the value, e.g. "16 to 19 pixels" (`value.srText`). */
  srText: string;
  /** Whether the value differs from pages as sites made them, or from the previous fit. */
  changed: boolean;
  /** One plain sentence in the design's voice. */
  sentence: string;
  /**
   * "Measured today", "Set by you", "From your answers in Tune", "Your system
   * setting", "Learned as you browse" or "Default".
   */
  source: string;
  sourceKind: SourceKind;
  confidence: ConfidenceLabel;
  /** Whether WebAble will change pages for this row without asking first. */
  changesPages: boolean;
}

export interface FitRowOptions {
  /** The browser's default font size, CSS px (default 16). */
  browserDefaultPx?: number;
  /** "Today" for the source line; defaults to the profile's creation day. */
  now?: Date;
}

const NBSP = ' ';
const px = (n: number) => `${formatNumber(n)}${NBSP}px`;
const ms = (n: number) => `${formatNumber(n)}${NBSP}ms`;
/** Rows with no real "before" of their own (FitValue's `same` text). */
const AS_SITE = 'As the site made it';
const SAME: FitRowValue = { kind: 'same', srText: 'as the site made it' };
const amount = (n: number): number => Math.round(n * 100) / 100;
const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

function formatNumber(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

function sourceLabel(
  kind: SourceKind,
  profile: FitProfile,
  now: Date | undefined,
): string {
  switch (kind) {
    case 'override':
    case 'stated':
      return 'Set by you';
    case 'system':
      return 'Your system setting';
    case 'learned':
      return 'Learned as you browse';
    case 'answered':
      return 'From your answers in Tune';
    case 'default':
      return 'Default';
    case 'measured': {
      const created = new Date(profile.createdAt);
      if (!now || Number.isNaN(created.getTime()) || sameDay(created, now))
        return 'Measured today';
      return `Measured ${MONTHS[created.getUTCMonth()] ?? ''} ${created.getUTCDate()}`;
    }
  }
}

/** Motor and vision parameters: high >= 0.7, medium >= 0.4. */
function paramConfidence(c: number): ConfidenceLabel {
  return c >= 0.7 ? 'high' : c >= 0.4 ? 'medium' : 'low';
}

/** Attention parameters: high > 0.5, medium >= 0.25. */
function latentConfidence(c: number): ConfidenceLabel {
  return c > 0.5 ? 'high' : c >= 0.25 ? 'medium' : 'low';
}

function latentSource(dim: LatentDim): SourceKind {
  if (dim.sources.includes('override')) return 'override';
  if (dim.sources.includes('learned')) return 'learned';
  if (dim.sources.includes('behavior')) return 'measured';
  if (dim.sources.some((s) => s === 'preference' || s === 'chips'))
    return 'answered';
  if (dim.sources.includes('system')) return 'system';
  return 'default';
}

interface Shown {
  value: string;
  sr: string;
  /** The Mono amount, when the value is a number ("19", "7:1"). */
  amount?: FitRowAmount;
  unit?: string;
}

function fitMark(
  before: Shown,
  after: Shown,
  unit: string | null,
): { srText: string; changed: boolean } {
  const changed = before.value !== after.value;
  if (!changed) return { srText: `${after.sr}, no change`, changed };
  if (unit)
    return {
      srText: `${before.sr.replace(` ${unit}`, '')} to ${after.sr}`,
      changed,
    };
  return { srText: `from ${before.sr} to ${after.sr}`, changed };
}

/* ------------------------------------------------------------------------ */
/* Per-row display                                                            */
/* ------------------------------------------------------------------------ */

function textShown(p: FitProfile, browserPx: number): Shown {
  const body = Math.max(p.vision.textMinPx.value, browserPx);
  return {
    value: px(body),
    sr: `${formatNumber(body)} pixels`,
    amount: amount(body),
    unit: 'px',
  };
}

function contrastShown(p: FitProfile): Shown {
  const v = p.vision.contrastFloor.value;
  if (v === 21) return { value: 'Maximum', sr: 'maximum contrast' };
  return {
    value: `${formatNumber(v)}:1`,
    sr: `${formatNumber(v)} to 1`,
    amount: `${formatNumber(v)}:1`,
  };
}

function polarityShown(p: FitProfile): Shown {
  const v = p.vision.polarity.value;
  if (v === 'dark') return { value: 'Dark', sr: 'dark pages' };
  if (v === 'light') return { value: 'Light', sr: 'light pages' };
  return { value: 'Site colors', sr: 'site colors' };
}

function spacingShown(p: FitProfile): Shown {
  const v = p.vision.lineHeight.value;
  return {
    value: formatNumber(v),
    sr: `line spacing ${formatNumber(v)}`,
    amount: amount(v),
  };
}

function lengthShown(p: FitProfile): Shown {
  const v = p.vision.maxLineCh.value;
  return {
    value: `${v}${NBSP}characters`,
    sr: `${v} characters`,
    amount: v,
    unit: 'characters',
  };
}

function targetShown(p: FitProfile): Shown {
  const v = p.motor.minTargetPx.value;
  return { value: px(v), sr: `${v} pixels`, amount: v, unit: 'px' };
}

function steadyShown(p: FitProfile): Shown {
  return p.motor.steadyClicks.value.on
    ? { value: 'On', sr: 'on' }
    : { value: 'Off', sr: 'off' };
}

function hoverShown(p: FitProfile): Shown {
  const v = p.motor.hoverGraceMs.value;
  return { value: ms(v), sr: `${v} milliseconds`, amount: v, unit: 'ms' };
}

function motionPaused(p: FitProfile): boolean {
  return needLevels(p).motion > 0;
}

function motionShown(p: FitProfile): Shown {
  return motionPaused(p)
    ? { value: 'Paused', sr: 'paused' }
    : { value: 'Plays', sr: 'plays' };
}

type BusyMode = 'simplified' | 'ask' | 'unchanged';

function busyMode(p: FitProfile): BusyMode {
  const distraction = needLevels(p).distraction;
  if (distraction === 2 || benefitProbability(p.attention.density) >= 0.6)
    return 'simplified';
  if (distraction === 1) return 'ask';
  return 'unchanged';
}

function busyShown(p: FitProfile): Shown {
  const mode = busyMode(p);
  if (mode === 'simplified') return { value: 'Simplified', sr: 'simplified' };
  if (mode === 'ask') return { value: 'Ask first', sr: 'ask first' };
  return { value: 'Unchanged', sr: 'unchanged' };
}

/* ------------------------------------------------------------------------ */
/* Values                                                                     */
/* ------------------------------------------------------------------------ */

/** A row with no real "before": what pages look like without WebAble. */
const SITE: Shown = { value: AS_SITE, sr: 'as the site made it' };

/** A setting in words against the site's own ("Site colors → Dark"), or `same`. */
function wordValue(site: Shown, after: Shown): FitRowValue {
  if (site.value === after.value) return SAME;
  return {
    kind: 'word',
    before: site.value,
    after: after.value,
    srText: `from ${site.sr} to ${after.sr}`,
  };
}

/** The recalibration change: Mono digits when both sides are numbers in one unit. */
function changeValue(before: Shown, after: Shown, srText: string): FitRowValue {
  if (
    before.amount !== undefined &&
    after.amount !== undefined &&
    before.unit === after.unit
  ) {
    return {
      kind: 'change',
      before: before.amount,
      after: after.amount,
      ...(after.unit ? { unit: after.unit } : {}),
      srText,
    };
  }
  return { kind: 'word', before: before.value, after: after.value, srText };
}

function textValue(p: FitProfile, browserPx: number): FitRowValue {
  const after = textShown(p, browserPx);
  const before = amount(browserPx);
  if (needLevels(p).text === 0 || after.amount === before) return SAME;
  return {
    kind: 'change',
    before,
    after: after.amount ?? before,
    unit: 'px',
    srText: `${formatNumber(before)} to ${after.sr}`,
  };
}

function contrastValue(p: FitProfile): FitRowValue {
  const v = p.vision.contrastFloor.value;
  if (needLevels(p).contrast === 0) return SAME;
  if (v === 21)
    return { kind: 'word', after: 'Maximum', srText: 'maximum contrast' };
  return {
    kind: 'floor',
    after: `${formatNumber(v)}:1`,
    srText: `at least ${formatNumber(v)} to 1`,
  };
}

function spacingValue(p: FitProfile): FitRowValue {
  const v = p.vision.lineHeight.value;
  if (needLevels(p).spacing === 0) return SAME;
  return {
    kind: 'floor',
    after: amount(v),
    srText: `at least ${formatNumber(v)}`,
  };
}

function lengthValue(p: FitProfile): FitRowValue {
  const v = p.vision.maxLineCh.value;
  if (needLevels(p).lineLength === 0) return SAME;
  return {
    kind: 'word',
    after: `Up to ${v}${NBSP}characters`,
    srText: `up to ${v} characters`,
  };
}

function targetValue(p: FitProfile): FitRowValue {
  const v = p.motor.minTargetPx.value;
  if (needLevels(p).targets === 0) return SAME;
  return {
    kind: 'floor',
    after: v,
    unit: 'px',
    srText: `at least ${v} pixels`,
  };
}

function hoverValue(p: FitProfile): FitRowValue {
  const v = p.motor.hoverGraceMs.value;
  if (v <= 0) return SAME;
  return {
    kind: 'floor',
    after: v,
    unit: 'ms',
    srText: `at least ${v} milliseconds`,
  };
}

/* ------------------------------------------------------------------------ */
/* Sentences                                                                  */
/* ------------------------------------------------------------------------ */

function textSentence(p: FitProfile, browserPx: number): string {
  const t = p.vision.textMinPx;
  const v = px(t.value);
  if (t.source === 'default') return 'Text stays the size each site made it.';
  if (t.source === 'override' || t.source === 'stated')
    return `You set text to ${v} or larger.`;
  if (t.value <= browserPx)
    return `Text reads well for you at ${v} or larger, so most pages already fit.`;
  return `Text reads best for you at ${v} or larger.`;
}

function contrastSentence(p: FitProfile): string {
  const v = p.vision.contrastFloor.value;
  if (v === 21) return 'Text uses the strongest contrast the page allows.';
  if (v === 7)
    return `Faint text is darkened to at least 7:1 against its background.`;
  return 'Most text already has enough contrast for you.';
}

function polaritySentence(p: FitProfile): string {
  const pol = p.vision.polarity;
  if (pol.value === 'none') return 'Pages keep their own colors.';
  const pair =
    pol.value === 'dark'
      ? 'Light text on a dark background'
      : 'Dark text on a light background';
  if (pol.source === 'override' || pol.source === 'stated')
    return `You chose ${pair.toLowerCase()}.`;
  if (pol.source === 'measured' && pol.confidence >= 0.6)
    return `${pair} reads faster for you.`;
  return `${pair} may be easier for you.`;
}

function spacingSentence(p: FitProfile): string {
  const lh = p.vision.lineHeight.value;
  const words = p.vision.wordSpacingEm.value > 0;
  if (needLevels(p).spacing === 0 && !words)
    return 'Line spacing stays as each site made it.';
  const what = words
    ? 'Lines and words of running text'
    : 'Lines of running text';
  return `${what} get more room, at ${formatNumber(lh)} line spacing.`;
}

function lengthSentence(p: FitProfile): string {
  if (needLevels(p).lineLength === 0)
    return 'Line length stays as each site made it.';
  return `Long lines of text wrap at about ${p.vision.maxLineCh.value}${NBSP}characters.`;
}

function targetSentence(p: FitProfile): string {
  const v = px(p.motor.minTargetPx.value);
  if (needLevels(p).targets === 0)
    return 'Click areas stay as each site made them.';
  if (
    p.motor.minTargetPx.source === 'override' ||
    p.motor.minTargetPx.source === 'stated'
  ) {
    return `You chose click areas up to ${v} where there’s room.`;
  }
  return `Click areas grow up to ${v} where there’s room.`;
}

function steadySentence(p: FitProfile): string {
  return p.motor.steadyClicks.value.on
    ? 'A click still counts if the pointer slips a little while you press.'
    : 'Clicks work as each site made them.';
}

function hoverSentence(p: FitProfile): string {
  const v = p.motor.hoverGraceMs.value;
  return v > 0
    ? `Menus that open on hover stay open ${ms(v)} after the pointer drifts off.`
    : 'Menus that open on hover close as each site made them.';
}

function motionSentence(p: FitProfile): string {
  if (!motionPaused(p)) return 'Moving things play as each site made them.';
  if (p.attention.systemReducedMotion)
    return 'Your device asks for less motion, so carousels and autoplay are paused.';
  return 'Carousels, tickers and autoplay are paused.';
}

function busySentence(p: FitProfile): string {
  const mode = busyMode(p);
  if (mode === 'simplified')
    return 'Ads and side panels are toned down so the main content stands out.';
  if (mode === 'ask')
    return 'On busy pages, WebAble asks before toning down side content.';
  return 'Busy pages keep everything the site put there.';
}

/* ------------------------------------------------------------------------ */
/* Rows                                                                       */
/* ------------------------------------------------------------------------ */

interface RowSpec {
  id: FitRowId;
  label: string;
  shown: (p: FitProfile) => Shown;
  /** What pages do without WebAble: a real value or setting, or "As the site made it". */
  site: Shown;
  /** This fit against pages as sites made them. */
  value: (p: FitProfile) => FitRowValue;
  unit: string | null;
  sentence: (p: FitProfile) => string;
  source: (p: FitProfile) => SourceKind;
  confidence: (p: FitProfile) => ConfidenceLabel;
  changes: (p: FitProfile) => boolean;
}

function rowSpecs(browserPx: number): RowSpec[] {
  return [
    {
      id: 'textSize',
      label: OP_LABELS.text_floor,
      shown: (p) => textShown(p, browserPx),
      site: {
        value: px(browserPx),
        sr: `${formatNumber(browserPx)} pixels`,
        amount: amount(browserPx),
        unit: 'px',
      },
      value: (p) => textValue(p, browserPx),
      unit: 'pixels',
      sentence: (p) => textSentence(p, browserPx),
      source: (p) => p.vision.textMinPx.source,
      confidence: (p) => paramConfidence(p.vision.textMinPx.confidence),
      changes: (p) => needLevels(p).text > 0,
    },
    {
      id: 'contrast',
      label: OP_LABELS.contrast,
      shown: contrastShown,
      site: SITE,
      value: contrastValue,
      unit: null,
      sentence: contrastSentence,
      source: (p) => p.vision.contrastFloor.source,
      confidence: (p) => paramConfidence(p.vision.contrastFloor.confidence),
      changes: (p) => needLevels(p).contrast > 0,
    },
    {
      id: 'polarity',
      label: 'Light or dark',
      shown: polarityShown,
      site: { value: 'Site colors', sr: 'site colors' },
      value: (p) =>
        wordValue(
          { value: 'Site colors', sr: 'site colors' },
          polarityShown(p),
        ),
      unit: null,
      sentence: polaritySentence,
      source: (p) => p.vision.polarity.source,
      confidence: (p) => paramConfidence(p.vision.polarity.confidence),
      changes: (p) => p.vision.polarity.value !== 'none',
    },
    {
      id: 'lineSpacing',
      label: OP_LABELS.line_spacing,
      shown: spacingShown,
      site: SITE,
      value: spacingValue,
      unit: null,
      sentence: spacingSentence,
      source: (p) => p.vision.lineHeight.source,
      confidence: (p) => paramConfidence(p.vision.lineHeight.confidence),
      changes: (p) => needLevels(p).spacing > 0,
    },
    {
      id: 'lineLength',
      label: OP_LABELS.line_length,
      shown: lengthShown,
      site: SITE,
      value: lengthValue,
      unit: 'characters',
      sentence: lengthSentence,
      source: (p) => p.vision.maxLineCh.source,
      confidence: (p) => paramConfidence(p.vision.maxLineCh.confidence),
      changes: (p) => needLevels(p).lineLength > 0,
    },
    {
      id: 'targets',
      label: OP_LABELS.target_size,
      shown: targetShown,
      site: SITE,
      value: targetValue,
      unit: 'pixels',
      sentence: targetSentence,
      source: (p) => p.motor.minTargetPx.source,
      confidence: (p) => paramConfidence(p.motor.minTargetPx.confidence),
      changes: (p) => needLevels(p).targets > 0,
    },
    {
      id: 'steadyClicks',
      label: OP_LABELS.steady_clicks,
      shown: steadyShown,
      site: { value: 'Off', sr: 'off' },
      value: (p) => wordValue({ value: 'Off', sr: 'off' }, steadyShown(p)),
      unit: null,
      sentence: steadySentence,
      source: (p) => p.motor.steadyClicks.source,
      confidence: (p) => paramConfidence(p.motor.steadyClicks.confidence),
      changes: (p) => p.motor.steadyClicks.value.on,
    },
    {
      id: 'hoverGrace',
      label: OP_LABELS.menu_grace,
      shown: hoverShown,
      site: SITE,
      value: hoverValue,
      unit: 'milliseconds',
      sentence: hoverSentence,
      source: (p) => p.motor.hoverGraceMs.source,
      confidence: (p) => paramConfidence(p.motor.hoverGraceMs.confidence),
      changes: (p) => p.motor.hoverGraceMs.value > 0,
    },
    {
      id: 'motion',
      label: OP_LABELS.calm_motion,
      shown: motionShown,
      site: { value: 'Plays', sr: 'plays' },
      value: (p) => wordValue({ value: 'Plays', sr: 'plays' }, motionShown(p)),
      unit: null,
      sentence: motionSentence,
      source: (p) => latentSource(p.attention.motion),
      confidence: (p) => latentConfidence(p.attention.motion.confidence),
      changes: motionPaused,
    },
    {
      id: 'busyPages',
      label: OP_LABELS.dim_distractions,
      shown: busyShown,
      site: { value: 'Unchanged', sr: 'unchanged' },
      value: (p) =>
        wordValue({ value: 'Unchanged', sr: 'unchanged' }, busyShown(p)),
      unit: null,
      sentence: busySentence,
      source: (p) => {
        const d = latentSource(p.attention.distraction);
        return d === 'default' ? latentSource(p.attention.density) : d;
      },
      confidence: (p) =>
        latentConfidence(
          Math.max(
            p.attention.distraction.confidence,
            p.attention.density.confidence,
          ),
        ),
      changes: (p) => busyMode(p) === 'simplified',
    },
  ];
}

/** Which Tune module measures each row (for dating values carried over on recalibration). */
const ROW_MODULE: Record<FitRowId, keyof FitProfile['modules']> = {
  textSize: 'reading',
  contrast: 'reading',
  polarity: 'reading',
  lineSpacing: 'reading',
  lineLength: 'reading',
  targets: 'pointing',
  steadyClicks: 'pointing',
  hoverGrace: 'pointing',
  motion: 'focus',
  busyPages: 'focus',
};

/**
 * Rows for the "Your fit" screen, in display order. Without `previous`, each
 * value is this fit against pages as sites made them (never an invented
 * "before"); with it, rows that changed show the recalibration diff
 * and the rest show this fit.
 */
export function fitRows(
  profile: FitProfile,
  previous?: FitProfile,
  options: FitRowOptions = {},
): FitRow[] {
  const browserPx =
    options.browserDefaultPx !== undefined && options.browserDefaultPx > 0
      ? options.browserDefaultPx
      : 16;
  return rowSpecs(browserPx).map((spec) => {
    const after = spec.shown(profile);
    const before = previous ? spec.shown(previous) : spec.site;
    let value = spec.value(profile);
    let changed = value.kind !== 'same';
    if (previous) {
      const diff = fitMark(before, after, spec.unit);
      changed = diff.changed;
      if (changed) value = changeValue(before, after, diff.srText);
    }
    const kind = spec.source(profile);
    // A module skipped during recalibration keeps the earlier measurement and its date.
    const measuredIn =
      previous && profile.modules[ROW_MODULE[spec.id]] !== 'measured'
        ? previous
        : profile;
    return {
      id: spec.id,
      label: spec.label,
      value,
      before: before.value,
      after: after.value,
      srText: value.srText,
      changed,
      sentence: spec.sentence(profile),
      source: sourceLabel(kind, measuredIn, options.now),
      sourceKind: kind,
      confidence: spec.confidence(profile),
      changesPages: spec.changes(profile),
    };
  });
}

/* ------------------------------------------------------------------------ */
/* WebAble's own UI                                                           */
/* ------------------------------------------------------------------------ */

export interface FitUiVars {
  /** Inline custom properties for the document root (tokens.css profile hooks). */
  style: {
    '--wa-text-scale': string;
    '--wa-target-min': string;
    '--wa-leading-add': string;
    '--wa-space-scale': string;
  };
  /** Root attributes; `data-wa-motion="reduce"` stills WebAble's own transitions. */
  attributes: { 'data-wa-motion'?: 'reduce' };
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function trim(n: number, digits: number): string {
  return String(Math.round(n * 10 ** digits) / 10 ** digits);
}

/**
 * CSS custom property values for WebAble's own UI:
 * - `--wa-text-scale` = textMinPx / 16, clamped 1..2 (never shrinks the UI);
 * - `--wa-target-min` = the profile's minimum target, never below 44 px;
 * - `--wa-leading-add` = line height above 1.5, clamped 0..0.7;
 * - `--wa-space-scale` = 1..1.5 from line spacing and the extra room between
 *   controls that slips call for;
 * - `data-wa-motion="reduce"` when the system asks for less motion or the fit
 *   shows a clear benefit from stillness.
 */
export function fitUiVars(profile: FitProfile): FitUiVars {
  const { vision, motor, attention } = profile;
  const textScale = clamp(vision.textMinPx.value / 16, 1, 2);
  const target = Math.max(44, motor.minTargetPx.value);
  const leading = clamp(vision.lineHeight.value - 1.5, 0, 0.7);
  const visionSpace = 1 + (5 / 6) * leading;
  const extraRoom = motor.targetSpacingPx.value - motor.minTargetPx.value;
  const motorSpace = 1 + clamp((extraRoom - 8) / 32, 0, 0.5);
  const space = clamp(Math.max(visionSpace, motorSpace), 1, 1.5);
  const reduce =
    attention.systemReducedMotion ||
    benefitProbability(attention.motion) >= 0.6;
  return {
    style: {
      '--wa-text-scale': trim(textScale, 3),
      '--wa-target-min': `${target}px`,
      '--wa-leading-add': trim(leading, 2),
      '--wa-space-scale': trim(space, 2),
    },
    attributes: reduce ? { 'data-wa-motion': 'reduce' } : {},
  };
}
