import { z } from 'zod';

import type { LayoutFeatures } from '../triage/types';
import {
  COUNT_BUCKETS,
  PAGE_CATEGORIES,
  PAGE_SIGNALS,
  REGION_ROLES,
  type PageCategory,
  type RegionRole,
} from './constants';

export * from './constants';

/**
 * Page vocabulary shared by the in-page engine (extraction), the policy
 * (service worker), and the page-analysis proxy (Edge Function).
 * Nothing in these types can carry page text, URLs, or form values.
 */

export const pageCategorySchema = z.enum(PAGE_CATEGORIES);

export const regionRoleSchema = z.enum(REGION_ROLES);

export const zoneSchema = z.enum([
  'header_band',
  'left_rail',
  'right_rail',
  'center_column',
  'full_width_mid',
  'footer_band',
  'overlay_top',
  'overlay_bottom',
  'overlay_center',
  'overlay_corner',
]);
export type Zone = z.infer<typeof zoneSchema>;

const widthBucket = z.enum(['<15%', '15-30%', '30-60%', '60-90%', '>90%']);
const countBucket = z.enum(COUNT_BUCKETS);

/** A word from the public UI vocabulary (VOCAB_V1). Enforced client- and server-side. */
export const vocabWordSchema = z.string().regex(/^[a-z]{2,20}$/);

/** Structural evidence about one region, sent inside that region's own question. */
export const regionEvidenceSchema = z.strictObject({
  zone: zoneSchema,
  width: widthBucket,
  height: z.enum([
    '<0.1 screens',
    '0.1-0.3 screens',
    '0.3-1 screens',
    '1-3 screens',
    '>3 screens',
  ]),
  pinned: z.enum(['fixed', 'sticky', 'no']),
  landmark: z.enum([
    'banner',
    'navigation',
    'main',
    'complementary',
    'contentinfo',
    'search',
    'form',
    'region',
    'dialog',
    'none',
  ]),
  tag: z.enum([
    'div',
    'section',
    'aside',
    'nav',
    'header',
    'footer',
    'form',
    'iframe',
    'ul',
    'article',
    'dialog',
    'other',
  ]),
  dom_position: z.enum(['before_main', 'inside_main', 'after_main', 'unknown']),
  links: countBucket,
  link_density: z.enum(['none', 'low', 'mid', 'high']),
  text_amount: z.enum([
    '0',
    '<100 chars',
    '100-500 chars',
    '500-2k chars',
    '>2k chars',
  ]),
  buttons: countBucket,
  inputs: countBucket,
  required_fields: z.boolean(),
  repeated_cards: z.enum(['0', '2-3', '4-8', '>8']),
  images: countBucket,
  video: z.boolean(),
  iframe_kind: z.enum([
    'none',
    'ad_network',
    'chat_vendor',
    'video_host',
    'social_embed',
    'map',
    'other',
  ]),
  motion: z.enum(['none', 'transition', 'loop', 'autoplay_video', 'carousel']),
  class_words: z.array(vocabWordSchema).max(6),
  /** Up to 6 vocabulary words joined by spaces; runs of dropped words are shown as '·'. */
  heading_words: z
    .string()
    .max(140)
    .regex(/^[a-z· ]*$/),
  control_words: z
    .array(
      z
        .string()
        .max(100)
        .regex(/^[a-z· ]*$/),
    )
    .max(4),
});
export type RegionEvidence = z.infer<typeof regionEvidenceSchema>;

export const pageSignalSchema = z.enum(PAGE_SIGNALS);

/** Page-level context sent as Jev `state`. */
export const pageContextSchema = z.strictObject({
  signals: z.array(pageSignalSchema).max(PAGE_SIGNALS.length),
  main: z.strictObject({
    found_by: z.enum([
      'landmark',
      'single_article',
      'readability',
      'ambiguous',
    ]),
    zone: z.union([zoneSchema, z.literal('unknown')]),
    width: z.union([widthBucket, z.literal('unknown')]),
  }),
  counts: z.strictObject({
    regions: countBucket,
    links: countBucket,
    buttons: countBucket,
    text_inputs: countBucket,
    forms: countBucket,
    required_fields: countBucket,
    headings: countBucket,
    images: countBucket,
    videos: countBucket,
    text_amount: z.enum([
      '<1k chars',
      '1k-10k chars',
      '10k-50k chars',
      '>50k chars',
    ]),
  }),
  layout: z.strictObject({
    viewport: z.enum(['phone', 'tablet', 'desktop']),
    page_height: z.enum([
      '<1 screen',
      '1-3 screens',
      '3-10 screens',
      '>10 screens',
    ]),
    pinned_bars: z.enum(['0', '1', '2', '3+']),
  }),
});
export type PageContext = z.infer<typeof pageContextSchema>;

/**
 * Local measurements the policy uses to decide applicability. Produced by the
 * content script; never leaves the device. Region keys are opaque component keys.
 */
export interface PageSignals {
  v: 1;
  lang: string;
  category: PageCategory;
  categoryConfidence: number;
  viewport: { width: number; height: number; dpr: number; zoom: number };
  text: {
    /** [font px (rounded), visible characters] for sampled text, main content weighted. */
    histogram: Array<[number, number]>;
    totalChars: number;
    mainFontPx: number | null;
    mainLineHeight: number | null;
    mainLineCh: number | null;
    /** Lightest rendered weight among sampled body text. */
    minWeight: number;
  };
  contrast: {
    sampled: number;
    below45: number;
    below7: number;
    unknownBackground: number;
  };
  targets: {
    count: number;
    /** Count of actionable targets whose hit area is below each ladder size. */
    below: Record<'24' | '32' | '44' | '56' | '72', number>;
    /** Targets whose neighbours are closer than the 24 px spacing circle. */
    crowded: number;
  };
  motion: {
    running: number;
    infinite: number;
    autoplayMedia: number;
    carousels: number;
    animatedImages: number;
  };
  sticky: { bars: number; topBandPx: number };
  hoverMenus: number;
  dragOnly: number;
  forms: {
    count: number;
    requiredFields: number;
    hasPassword: boolean;
    hasPayment: boolean;
  };
  main: { key: string | null; ambiguous: boolean };
  regions: Array<{
    key: string;
    zone: Zone;
    areaPct: number;
    pinned: 'fixed' | 'sticky' | 'no';
    /** Role decided by high-precision local rules, if any. */
    ruleRole: RegionRole | null;
    rulePrecision: number;
    ruleId: string | null;
    hasRequiredFields: boolean;
    containsFocus: boolean;
    motion: RegionEvidence['motion'];
  }>;
  env: {
    reducedMotion: boolean;
    forcedColors: boolean;
    colorScheme: 'light' | 'dark';
  };
  /**
   * Person-independent layout features for triage. Absent from
   * engines older than v2; the worker then treats the page as un-triaged.
   */
  layout?: LayoutFeatures;
}
