import { z } from 'zod';

/**
 * The fit profile describes which interface characteristics work best for one
 * person. It never names a condition. Every parameter records where its value
 * came from so user authority (override) and evidence (measured) both survive.
 *
 * Effective value precedence: override > learned > measured > stated > system > default.
 */

export const paramSourceSchema = z.enum([
  'measured',
  'stated',
  'override',
  'learned',
  'system',
  'default',
]);
export type ParamSource = z.infer<typeof paramSourceSchema>;

const confidence = z.number().min(0).max(1);

function param<T extends z.ZodType>(value: T) {
  return z.object({
    value,
    source: paramSourceSchema,
    confidence,
    /** Kept separately so an override never erases the evidence. */
    measured: value.optional(),
    stated: value.optional(),
    override: value.optional(),
  });
}

/** A latent attention dimension on a benefit scale (0 = no expected benefit). */
export const latentDimSchema = z.object({
  mean: z.number().min(-1).max(2),
  sd: z.number().min(0).max(2),
  confidence,
  sources: z
    .array(
      z.enum([
        'behavior',
        'preference',
        'system',
        'chips',
        'learned',
        'override',
      ]),
    )
    .max(6),
});
export type LatentDim = z.infer<typeof latentDimSchema>;

export const TARGET_LADDER = [24, 32, 44, 56, 72, 96] as const;
export type TargetPx = (typeof TARGET_LADDER)[number];

export const inputClassSchema = z.enum([
  'mouse',
  'trackpad',
  'touch',
  'keyboard',
  'other',
]);
export type InputClass = z.infer<typeof inputClassSchema>;

export const deviceClassSchema = z.enum([
  'phone',
  'tablet',
  'laptop',
  'desktop',
]);
export type DeviceClass = z.infer<typeof deviceClassSchema>;

export const polaritySchema = z.enum(['light', 'dark', 'none']);
export type Polarity = z.infer<typeof polaritySchema>;

/** 4.5 = standard floor, 7 = enhanced, 21 = maximum (snap text to the polarity pair). */
export const contrastFloorSchema = z.union([
  z.literal(4.5),
  z.literal(7),
  z.literal(21),
]);
export type ContrastFloor = z.infer<typeof contrastFloorSchema>;

export const visionSchema = z.object({
  /** Minimum rendered font size in CSS px for body text. Only ever enlarges. */
  textMinPx: param(z.number().min(12).max(96)),
  /** Minimum x-height in CSS px at 100% zoom (for font-size-adjust aware floors). */
  xHeightMinPx: z.number().min(4).max(60).optional(),
  contrastFloor: param(contrastFloorSchema),
  polarity: param(polaritySchema),
  fontWeightFloor: param(
    z.union([z.literal(400), z.literal(500), z.literal(600)]),
  ),
  lineHeight: param(z.number().min(1.2).max(2.2)),
  wordSpacingEm: param(z.number().min(0).max(0.3)),
  letterSpacingEm: param(z.number().min(0).max(0.12)),
  maxLineCh: param(z.number().int().min(45).max(100)),
});
export type VisionFit = z.infer<typeof visionSchema>;

export const motorSchema = z.object({
  input: inputClassSchema,
  /** Minimum effective (hit-area) target size in CSS px. */
  minTargetPx: param(
    z.union(
      TARGET_LADDER.map((n) => z.literal(n)) as [
        z.ZodLiteral<24>,
        z.ZodLiteral<32>,
        z.ZodLiteral<44>,
        z.ZodLiteral<56>,
        z.ZodLiteral<72>,
        z.ZodLiteral<96>,
      ],
    ),
  ),
  /** Desired centre-to-centre clearance between adjacent actionable targets. */
  targetSpacingPx: param(z.number().min(0).max(160)),
  steadyClicks: param(
    z.object({
      on: z.boolean(),
      windowMs: z.number().int().min(200).max(400),
      radiusPx: z.number().min(4).max(48),
    }),
  ),
  repeatGuard: param(
    z.object({ on: z.boolean(), windowMs: z.number().int().min(300).max(600) }),
  ),
  drag: param(z.enum(['none', 'some', 'high'])),
  hoverGraceMs: param(z.union([z.literal(0), z.literal(400), z.literal(700)])),
});
export type MotorFit = z.infer<typeof motorSchema>;

export const attentionSchema = z.object({
  motion: latentDimSchema,
  distraction: latentDimSchema,
  density: latentDimSchema,
  chunking: latentDimSchema,
  guidance: latentDimSchema,
  /** The operating system asks apps to minimise motion. */
  systemReducedMotion: z.boolean(),
});
export type AttentionFit = z.infer<typeof attentionSchema>;

export const moduleStatusSchema = z.enum(['measured', 'skipped', 'not_run']);

export const fitProfileSchema = z.object({
  v: z.literal(1),
  derivationVersion: z.string(),
  calibrationVersion: z.string().nullable(),
  createdAt: z.iso.datetime(),
  device: z.object({ class: deviceClassSchema, input: inputClassSchema }),
  modules: z.object({
    reading: moduleStatusSchema,
    pointing: moduleStatusSchema,
    focus: moduleStatusSchema,
  }),
  vision: visionSchema,
  motor: motorSchema,
  attention: attentionSchema,
  /** Overall calibration confidence, 0 when nothing was measured. */
  confidence,
});
export type FitProfile = z.infer<typeof fitProfileSchema>;

/**
 * Coarse need levels per functional area, derived from the profile.
 * 0 = no change expected, 1 = some benefit, 2 = strong benefit.
 * These drive prior tables and which ops the policy considers.
 */
export const NEED_AREAS = [
  'text',
  'contrast',
  'spacing',
  'lineLength',
  'targets',
  'clicks',
  'motion',
  'distraction',
] as const;
export type NeedArea = (typeof NEED_AREAS)[number];
export type NeedLevel = 0 | 1 | 2;
export type NeedLevels = Record<NeedArea, NeedLevel>;
