import { OP_LABELS } from '../explain/glossary';
import type { NeedArea } from '../profile/schema';

/**
 * The reviewed adaptation library. AI never invents operations: it can only
 * influence whether one of these applies and to which page regions. Every op
 * is bounded (a fixed ladder of intensities), reversible (removable on its
 * own), and verified after it is applied.
 */
export const OP_IDS = [
  'text_floor',
  'page_zoom',
  'line_spacing',
  'line_length',
  'contrast',
  'focus_outline',
  'target_size',
  'target_spacing',
  'steady_clicks',
  'menu_grace',
  'calm_motion',
  'pause_media',
  'dim_distractions',
  'focus_view',
  'unpin_bars',
  'reading_guide',
] as const;
export type OpId = (typeof OP_IDS)[number];

/** Continuous preferences learned per person (Learner B), in natural units. */
export const DIM_IDS = [
  'textPx',
  'zoom',
  'lineHeight',
  'lineCh',
  'targetPx',
  'clickWindowMs',
  'dimOpacity',
] as const;
export type DimId = (typeof DIM_IDS)[number];

/**
 * paint:    colour, outline, opacity, overlay. Cannot move layout.
 * layout:   can change box sizes or positions. Verified for clipping, overlap, overflow.
 * behavior: changes how input is interpreted or media plays. Never touches keyboard handling.
 */
export type OpRisk = 'paint' | 'layout' | 'behavior';

export interface OpDefinition {
  id: OpId;
  /** Short noun phrase used everywhere a change is listed. Describes the page, never the person. */
  label: string;
  /** One sentence, plain language, used in "Why this changed" and settings. */
  description: string;
  areas: readonly NeedArea[];
  dim: DimId | null;
  /** Reviewed intensity ladder. Level index 0 is the gentlest. */
  levels: readonly number[];
  unit: 'px' | 'x' | 'ratio' | 'ch' | 'ms' | 'opacity' | 'none';
  risk: OpRisk;
  /** 'region' ops apply to specific page regions; 'page' ops apply everywhere. */
  scope: 'page' | 'region';
  /** Consumes page-analysis answers (region roles / main content). */
  usesPageAnalysis: boolean;
  /** Can run from a registered stylesheet before first paint (no measurement needed). */
  prePaint: boolean;
  /** Safe enough to be switched on from a profile without an offer, when evidence is strong. */
  autoEligible: boolean;
}

export const OP_CATALOG: Readonly<Record<OpId, OpDefinition>> = {
  text_floor: {
    id: 'text_floor',
    label: OP_LABELS.text_floor,
    description:
      'Enlarges running text in the main content to your size; the page scale handles the rest.',
    areas: ['text'],
    dim: 'textPx',
    /**
     * Effective px for running text (CSS px at 100% page zoom, the unit Tune
     * measures in). With a page scale the engine aims at level / zoom CSS px,
     * so the person sees the level.
     */
    levels: [14, 16, 18, 21, 24, 28, 32, 40, 48],
    unit: 'px',
    risk: 'layout',
    scope: 'page',
    usesPageAnalysis: false,
    prePaint: false,
    autoEligible: true,
  },
  page_zoom: {
    id: 'page_zoom',
    label: OP_LABELS.page_zoom,
    description:
      'Scales this page so its text comes closer to your size. Text, buttons and images grow together.',
    areas: ['text'],
    dim: 'zoom',
    /** Chrome's zoom presets (110-200%): the scale triage chooses, never above the breakpoint-safe zoom. */
    levels: [1.1, 1.25, 1.5, 1.75, 2],
    unit: 'x',
    risk: 'layout',
    scope: 'page',
    usesPageAnalysis: false,
    prePaint: false,
    autoEligible: true,
  },
  line_spacing: {
    id: 'line_spacing',
    label: OP_LABELS.line_spacing,
    description: 'Adds space between lines and words of running text.',
    areas: ['spacing'],
    dim: 'lineHeight',
    levels: [1.5, 1.6, 1.8, 2],
    unit: 'ratio',
    risk: 'layout',
    scope: 'page',
    usesPageAnalysis: true,
    prePaint: false,
    autoEligible: true,
  },
  line_length: {
    id: 'line_length',
    label: OP_LABELS.line_length,
    description: 'Keeps long lines of text to a comfortable width.',
    areas: ['lineLength'],
    dim: 'lineCh',
    levels: [80, 70, 62],
    unit: 'ch',
    risk: 'layout',
    scope: 'region',
    usesPageAnalysis: true,
    prePaint: false,
    autoEligible: true,
  },
  contrast: {
    id: 'contrast',
    label: OP_LABELS.contrast,
    description:
      'Darkens faint text against its background. Colours and layout stay the same.',
    areas: ['contrast'],
    dim: null,
    levels: [4.5, 7, 21],
    unit: 'ratio',
    risk: 'paint',
    scope: 'page',
    usesPageAnalysis: false,
    prePaint: false,
    autoEligible: true,
  },
  focus_outline: {
    id: 'focus_outline',
    label: OP_LABELS.focus_outline,
    description: 'Shows a clear outline around whatever the keyboard is on.',
    areas: ['targets', 'contrast'],
    dim: null,
    levels: [3],
    unit: 'px',
    risk: 'paint',
    scope: 'page',
    usesPageAnalysis: false,
    prePaint: true,
    autoEligible: true,
  },
  target_size: {
    id: 'target_size',
    label: OP_LABELS.target_size,
    description:
      'Makes the clickable area around small links and buttons larger where there’s room, without moving them.',
    areas: ['targets'],
    dim: 'targetPx',
    levels: [24, 32, 44, 56, 72],
    unit: 'px',
    risk: 'paint',
    scope: 'page',
    usesPageAnalysis: false,
    prePaint: false,
    autoEligible: true,
  },
  target_spacing: {
    id: 'target_spacing',
    label: OP_LABELS.target_spacing,
    description:
      'Adds room between links and buttons that sit very close together.',
    areas: ['targets'],
    dim: null,
    levels: [4, 8, 12],
    unit: 'px',
    risk: 'layout',
    scope: 'page',
    usesPageAnalysis: false,
    prePaint: false,
    autoEligible: false,
  },
  steady_clicks: {
    id: 'steady_clicks',
    label: OP_LABELS.steady_clicks,
    description:
      'Counts a click on the button you pressed, even if the pointer slips a little before you let go.',
    areas: ['clicks'],
    dim: 'clickWindowMs',
    levels: [200, 300, 400],
    unit: 'ms',
    risk: 'behavior',
    scope: 'page',
    usesPageAnalysis: false,
    prePaint: false,
    autoEligible: false,
  },
  menu_grace: {
    id: 'menu_grace',
    label: OP_LABELS.menu_grace,
    description:
      'Keeps menus that open on hover from closing the moment the pointer drifts off.',
    areas: ['clicks'],
    dim: null,
    levels: [400, 700],
    unit: 'ms',
    risk: 'behavior',
    scope: 'page',
    usesPageAnalysis: false,
    prePaint: false,
    autoEligible: false,
  },
  calm_motion: {
    id: 'calm_motion',
    label: OP_LABELS.calm_motion,
    description: 'Stops decorative animation and makes transitions instant.',
    areas: ['motion'],
    dim: null,
    levels: [1],
    unit: 'none',
    risk: 'paint',
    scope: 'page',
    usesPageAnalysis: false,
    prePaint: true,
    autoEligible: true,
  },
  pause_media: {
    id: 'pause_media',
    label: OP_LABELS.pause_media,
    description:
      'Pauses videos and animated images that start on their own. You can play them again.',
    areas: ['motion', 'distraction'],
    dim: null,
    levels: [1],
    unit: 'none',
    risk: 'behavior',
    scope: 'page',
    usesPageAnalysis: false,
    prePaint: false,
    autoEligible: true,
  },
  dim_distractions: {
    id: 'dim_distractions',
    label: OP_LABELS.dim_distractions,
    description:
      'Fades ads and side rails so the main content stands out. Hover or tab into them to bring them back.',
    areas: ['distraction'],
    dim: 'dimOpacity',
    levels: [0.6, 0.45, 0.3],
    unit: 'opacity',
    risk: 'paint',
    scope: 'region',
    usesPageAnalysis: true,
    prePaint: false,
    autoEligible: true,
  },
  focus_view: {
    id: 'focus_view',
    label: OP_LABELS.focus_view,
    description: 'Softens everything except the main content.',
    areas: ['distraction'],
    dim: null,
    levels: [0.5],
    unit: 'opacity',
    risk: 'paint',
    scope: 'region',
    usesPageAnalysis: true,
    prePaint: false,
    autoEligible: false,
  },
  unpin_bars: {
    id: 'unpin_bars',
    label: OP_LABELS.unpin_bars,
    description:
      'Lets bars that stick to the top of the screen scroll away with the page.',
    areas: ['text', 'distraction'],
    dim: null,
    levels: [1],
    unit: 'none',
    risk: 'layout',
    scope: 'region',
    usesPageAnalysis: true,
    prePaint: false,
    autoEligible: false,
  },
  reading_guide: {
    id: 'reading_guide',
    label: OP_LABELS.reading_guide,
    description: 'Shades the page above and below the line you are reading.',
    areas: ['spacing', 'distraction'],
    dim: null,
    levels: [1],
    unit: 'none',
    risk: 'paint',
    scope: 'page',
    usesPageAnalysis: false,
    prePaint: false,
    autoEligible: false,
  },
};

/**
 * Ops kept in the catalog (stored learning, history and old plans still name
 * them) that WebAble no longer applies. None today: page_zoom, retired on
 * 2026-09-30, came back in v2 as the page scale that composes with
 * text_floor, chosen by triage within the breakpoint-safe zoom.
 */
export const RETIRED_OPS: ReadonlySet<OpId> = new Set<OpId>();

export const opDefinition = (id: OpId): OpDefinition => OP_CATALOG[id];

/** Human-readable value for an op level, e.g. "18 px", "1.8", "70 characters", "300 ms" (no-break space before the unit). */
export function formatOpValue(id: OpId, level: number): string {
  const def = OP_CATALOG[id];
  const value =
    def.levels[Math.max(0, Math.min(level, def.levels.length - 1))] ?? 0;
  switch (def.unit) {
    case 'px':
      return `${value} px`;
    case 'x':
      return `${Math.round(value * 100)}%`;
    case 'ratio':
      return id === 'contrast'
        ? value >= 21
          ? 'Maximum'
          : `${value}:1`
        : String(value);
    case 'ch':
      return `${value}\u00a0characters`;
    case 'ms':
      return `${value} ms`;
    case 'opacity':
      return `${Math.round((1 - value) * 100)}%\u00a0softer`;
    case 'none':
      return 'On';
  }
}

/** Index of the ladder level nearest a continuous value (log space for ratios of scale). */
export function nearestLevel(id: OpId, value: number): number {
  const levels = OP_CATALOG[id].levels;
  let best = 0;
  let bestDist = Infinity;
  levels.forEach((level, index) => {
    const dist = Math.abs(
      Math.log(Math.max(level, 1e-6)) - Math.log(Math.max(value, 1e-6)),
    );
    if (dist < bestDist) {
      bestDist = dist;
      best = index;
    }
  });
  return best;
}
