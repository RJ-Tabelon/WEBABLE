import { normCdf } from '../profile/needs';
import type { FitProfile, LatentDim } from '../profile/schema';

/**
 * Structure need: how much this person is helped when a page's
 * structure changes while its content stays the same. It comes from Tune's
 * Focus module, which times each person on manipulated pages: busy vs clean
 * (distraction), dense vs spaced (density), dense vs chunked text (chunking)
 * and weak vs strong hierarchy (guidance). Each latent is a within-person
 * effect, so P(benefit > 0) is evidence about this person, not a trait.
 *
 * The level decides how Fit view reaches a cluttered page:
 *   2  restructure automatically (one click back to the original page)
 *   1  offer it
 *   0  leave the structure alone (Fit view stays available on request)
 *
 * Gates use the posterior P(benefit > 0), never the mean, as triage does:
 * inaccurate adaptation is worse than none (Gajos 2008).
 */

export type StructureLevel = 0 | 1 | 2;

export const STRUCTURE_DIMS = [
  'distraction',
  'density',
  'chunking',
  'guidance',
] as const;
export type StructureDim = (typeof STRUCTURE_DIMS)[number];

/** P(benefit > 0) at or above which the page is restructured automatically. */
export const STRUCTURE_AUTO_P = 0.8;
/** P(benefit > 0) at or above which restructuring is offered. */
export const STRUCTURE_OFFER_P = 0.6;

export interface StructureNeed {
  level: StructureLevel;
  /** The strongest P(benefit > 0) among the dimensions Tune informed (0 when none). */
  p: number;
  /** P(benefit > 0) per dimension; null where nothing informed it (flat prior). */
  dims: Record<StructureDim, number | null>;
}

/** P(benefit > 0), as triage computes it (`triage.ts` benefitPositive). */
const benefit = (dim: LatentDim): number =>
  normCdf(dim.mean / Math.max(dim.sd, 0.05));

/** Something other than the flat default prior informed this dimension. */
export const informed = (dim: LatentDim): boolean =>
  dim.confidence > 0 || dim.sources.length > 0;

export function structureNeed(profile: FitProfile): StructureNeed {
  const dims = {} as Record<StructureDim, number | null>;
  let p = 0;
  for (const key of STRUCTURE_DIMS) {
    const dim = profile.attention[key];
    const value = informed(dim) ? benefit(dim) : null;
    dims[key] = value === null ? null : Math.round(value * 1000) / 1000;
    if (value !== null && value > p) p = value;
  }
  const level: StructureLevel =
    p >= STRUCTURE_AUTO_P ? 2 : p >= STRUCTURE_OFFER_P ? 1 : 0;
  return { level, p: Math.round(p * 1000) / 1000, dims };
}

/** P(benefit > 0) for one dimension, 0 when Tune never informed it. */
export const dimP = (need: StructureNeed, dim: StructureDim): number =>
  need.dims[dim] ?? 0;
