import { z } from 'zod';

import { CATALOG_VERSION } from '../versions';
import {
  pageCategorySchema,
  pageContextSchema,
  regionEvidenceSchema,
  regionRoleSchema,
  type PageCategory,
  type RegionRole,
} from '../page/types';

/**
 * Extension service worker -> Supabase Edge Function `decide`.
 * Evidence only: no question text, URL, domain, title, profile, or page text.
 * Region ids are ephemeral per page view.
 */
export const regionIdSchema = z.string().regex(/^r\d{1,2}$/);
export const candidateIdSchema = z.enum(['c1', 'c2', 'c3', 'c4']);

export const decideRequestSchema = z.strictObject({
  v: z.literal(1),
  catalog: z.literal(CATALOG_VERSION),
  lang: z.literal('en'),
  page: pageContextSchema,
  regions: z
    .array(z.strictObject({ rid: regionIdSchema, ev: regionEvidenceSchema }))
    .max(10),
  mainCandidates: z
    .array(z.strictObject({ cid: candidateIdSchema, ev: regionEvidenceSchema }))
    .min(2)
    .max(4)
    .optional(),
  ask: z.strictObject({ pageType: z.boolean() }),
});
export type DecideRequest = z.infer<typeof decideRequestSchema>;

const prob = z.number().min(0).max(1);

export const regionAnswerSchema = z.object({
  role: z.record(regionRoleSchema, prob),
  /** P(visitor doing the page's main task needs this region). */
  task: prob,
});
export type RegionAnswer = z.infer<typeof regionAnswerSchema>;

export const degradedReasonSchema = z.enum([
  'timeout',
  'rate_limited',
  'overloaded',
  'upstream',
  'model_drift',
  'catalog_mismatch',
  'quota',
  'bad_input',
  'unconfigured',
]);
export type DegradedReason = z.infer<typeof degradedReasonSchema>;

export const decideResponseSchema = z.discriminatedUnion('ok', [
  z.object({
    v: z.literal(1),
    ok: z.literal(true),
    catalog: z.literal(CATALOG_VERSION),
    model: z.string(),
    pageType: z.record(pageCategorySchema, prob).optional(),
    mainPick: z
      .partialRecord(z.enum(['c1', 'c2', 'c3', 'c4', 'none']), prob)
      .optional(),
    regions: z.record(regionIdSchema, regionAnswerSchema),
    inputTokens: z.number().int().nonnegative(),
    ms: z.object({
      jev: z.number().nonnegative(),
      edge: z.number().nonnegative(),
    }),
  }),
  z.object({
    v: z.literal(1),
    ok: z.literal(false),
    degraded: degradedReasonSchema,
    retryAfterMs: z.number().int().nonnegative().optional(),
  }),
]);
export type DecideResponse = z.infer<typeof decideResponseSchema>;

export type { PageCategory, RegionRole };
