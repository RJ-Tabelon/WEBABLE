import { describe, expect, it } from 'vitest';

import {
  FIT_DISTINCT_SIZE_RATIO,
  FIT_MAX_WEIGHT,
  FIT_RAMP_ANCHORS,
  rampRatios,
  tiersDistinguishable,
  typeRamp,
  type TypeRamp,
} from './typeramp';

const ORDER: Array<keyof TypeRamp> = [
  'pageHeading',
  'sectionHeading',
  'title',
  'body',
  'meta',
];

describe('rampRatios', () => {
  it('hits every anchor and holds the ends outside the 16-40 px band', () => {
    for (const a of FIT_RAMP_ANCHORS) {
      const r = rampRatios(a.F);
      expect(r.pageHeading).toBeCloseTo(a.ratios.pageHeading, 10);
      expect(r.sectionHeading).toBeCloseTo(a.ratios.sectionHeading, 10);
      expect(r.title).toBeCloseTo(a.ratios.title, 10);
    }
    const first = FIT_RAMP_ANCHORS[0]!.ratios;
    const last = FIT_RAMP_ANCHORS[FIT_RAMP_ANCHORS.length - 1]!.ratios;
    for (const F of [12, 14]) expect(rampRatios(F)).toEqual(first);
    for (const F of [64, 96]) expect(rampRatios(F)).toEqual(last);
    // Between anchors: in between.
    const mid = rampRatios(20);
    expect(mid.pageHeading).toBeLessThan(2.5);
    expect(mid.pageHeading).toBeGreaterThan(2.0);
  });

  it('compresses smoothly and keeps the tier order at every size', () => {
    let prev = rampRatios(12);
    for (let F = 12.5; F <= 96; F += 0.5) {
      const r = rampRatios(F);
      expect(r.pageHeading).toBeLessThanOrEqual(prev.pageHeading + 1e-12);
      expect(r.sectionHeading).toBeLessThanOrEqual(prev.sectionHeading + 1e-12);
      expect(r.title).toBeLessThanOrEqual(prev.title + 1e-12);
      expect(r.pageHeading).toBeGreaterThan(r.sectionHeading);
      expect(r.sectionHeading).toBeGreaterThan(r.title);
      expect(r.title).toBeGreaterThan(1);
      // F x ratio never shrinks as F grows (a larger floor, larger headings).
      for (const k of ['pageHeading', 'sectionHeading', 'title'] as const)
        expect(F * r[k]).toBeGreaterThanOrEqual((F - 0.5) * prev[k] - 1e-9);
      prev = r;
    }
  });
});

describe('typeRamp', () => {
  it('matches the reference ramp at the default size: size, not weight, leads', () => {
    expect(typeRamp(16, 400)).toEqual({
      pageHeading: { px: 40, weight: 600, cue: 'none' },
      sectionHeading: { px: 28, weight: 600, cue: 'none' },
      title: { px: 20, weight: 600, cue: 'none' },
      body: { px: 16, weight: 400, cue: 'none' },
      meta: { px: 14, weight: 400, cue: 'none' },
    });
    expect(typeRamp(24, 400)).toEqual({
      pageHeading: { px: 48, weight: 600, cue: 'none' },
      sectionHeading: { px: 36, weight: 600, cue: 'none' },
      title: { px: 28, weight: 600, cue: 'none' },
      body: { px: 24, weight: 400, cue: 'none' },
      meta: { px: 20.5, weight: 400, cue: 'none' },
    });
  });

  it('never uses 700 unless the weight floor asks for it', () => {
    for (let F = 12; F <= 96; F += 0.5) {
      const r = typeRamp(F, 400);
      for (const t of ORDER) expect(r[t].weight, `${F} ${t}`).toBeLessThan(700);
    }
  });

  it('carries compressed tiers with cues at large print', () => {
    expect(typeRamp(40, 600)).toEqual({
      pageHeading: { px: 54, weight: 600, cue: 'band' },
      sectionHeading: { px: 47, weight: 600, cue: 'rule' },
      title: { px: 43, weight: 600, cue: 'space' },
      body: { px: 40, weight: 600, cue: 'none' },
      meta: { px: 34, weight: 600, cue: 'none' },
    });
  });

  it('uses weight before a cue when weight can still separate two tiers', () => {
    // Title vs body at F=40, regular body: 43/40 < 1.15 but 600 - 400 = 200.
    const r = typeRamp(40, 400);
    expect(r.title).toEqual({ px: 43, weight: 600, cue: 'none' });
    // Floor 500: the title is lifted to 700 to stay 200 above body.
    expect(typeRamp(40, 500).title).toEqual({
      px: 43,
      weight: 700,
      cue: 'none',
    });
  });

  it('keeps body at F exactly (render health: body px x zoom = F)', () => {
    for (const F of [12, 16, 20.16, 24, 33.6, 96])
      expect(typeRamp(F, 400).body.px).toBe(F);
  });

  it('holds every invariant across sizes and weight floors', () => {
    for (let F = 12; F <= 96; F += 0.25) {
      for (const floor of [400, 500, 600]) {
        const r = typeRamp(F, floor);
        // Sizes: strictly decreasing to body, meta at or below body, all finite and positive.
        expect(r.pageHeading.px).toBeGreaterThan(r.sectionHeading.px);
        expect(r.sectionHeading.px).toBeGreaterThan(r.title.px);
        expect(r.title.px).toBeGreaterThan(r.body.px);
        expect(r.meta.px).toBeLessThanOrEqual(r.body.px);
        expect(r.meta.px).toBeGreaterThanOrEqual(Math.min(14, F) - 0.5);
        for (const t of ORDER) {
          expect(Number.isFinite(r[t].px) && r[t].px > 0, `${F} ${t}`).toBe(
            true,
          );
          expect(r[t].weight).toBeGreaterThanOrEqual(floor);
          expect(r[t].weight).toBeLessThanOrEqual(FIT_MAX_WEIGHT);
        }
        // Distinguishability along the heading chain down to body.
        expect(
          tiersDistinguishable(r.pageHeading, r.sectionHeading),
          `${F}/${floor}`,
        ).toBe(true);
        expect(
          tiersDistinguishable(r.sectionHeading, r.title),
          `${F}/${floor}`,
        ).toBe(true);
        expect(tiersDistinguishable(r.title, r.body), `${F}/${floor}`).toBe(
          true,
        );
        // Cues appear only where size and weight do not already separate.
        if (r.title.cue !== 'none')
          expect(r.title.px / r.body.px).toBeLessThan(FIT_DISTINCT_SIZE_RATIO);
        // Monotone in F: a larger floor never shrinks a tier.
        const bigger = typeRamp(F + 0.25, floor);
        for (const t of ORDER)
          expect(bigger[t].px).toBeGreaterThanOrEqual(r[t].px);
      }
    }
  });
});

describe('tiersDistinguishable', () => {
  it('accepts size, weight or a cue', () => {
    const body = { px: 20, weight: 400 as const, cue: 'none' as const };
    expect(
      tiersDistinguishable({ px: 23, weight: 400, cue: 'none' }, body),
    ).toBe(true);
    expect(
      tiersDistinguishable({ px: 22, weight: 400, cue: 'none' }, body),
    ).toBe(false);
    expect(
      tiersDistinguishable({ px: 22, weight: 600, cue: 'none' }, body),
    ).toBe(true);
    expect(
      tiersDistinguishable({ px: 22, weight: 500, cue: 'rule' }, body),
    ).toBe(true);
  });
});
