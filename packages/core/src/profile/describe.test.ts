import { describe, expect, it } from 'vitest';

import { defaultFitProfile, DEFAULT_SYSTEM_SIGNALS } from './defaults';
import { fitRows, fitUiVars, type FitRow } from './describe';
import type { FitProfile } from './schema';

const NBSP = ' ';
const NOW = new Date('2026-09-29T12:00:00.000Z');

function base(): FitProfile {
  return defaultFitProfile(DEFAULT_SYSTEM_SIGNALS, NOW);
}

/** A large-print, contrast-limited, imprecise-pointer fit, as after a Tune. */
function fitted(): FitProfile {
  const p = base();
  return {
    ...p,
    modules: { reading: 'measured', pointing: 'measured', focus: 'measured' },
    vision: {
      ...p.vision,
      textMinPx: {
        value: 19,
        source: 'measured',
        confidence: 0.8,
        measured: 19,
      },
      contrastFloor: {
        value: 7,
        source: 'measured',
        confidence: 0.55,
        measured: 7,
      },
      polarity: {
        value: 'dark',
        source: 'measured',
        confidence: 0.8,
        measured: 'dark',
        stated: 'dark',
      },
      lineHeight: {
        value: 1.8,
        source: 'measured',
        confidence: 0.35,
        measured: 1.8,
      },
      wordSpacingEm: {
        value: 0.16,
        source: 'measured',
        confidence: 0.35,
        measured: 0.16,
      },
      maxLineCh: {
        value: 70,
        source: 'measured',
        confidence: 0.4,
        measured: 70,
      },
    },
    motor: {
      ...p.motor,
      minTargetPx: {
        value: 56,
        source: 'measured',
        confidence: 0.62,
        measured: 56,
      },
      targetSpacingPx: {
        value: 56,
        source: 'measured',
        confidence: 0.62,
        measured: 56,
      },
      steadyClicks: {
        value: { on: true, windowMs: 300, radiusPx: 12 },
        source: 'measured',
        confidence: 0.89,
      },
      hoverGraceMs: {
        value: 400,
        source: 'measured',
        confidence: 0.25,
        measured: 400,
      },
    },
    attention: {
      ...p.attention,
      motion: {
        mean: 0.5,
        sd: 0.1,
        confidence: 0.7,
        sources: ['preference', 'behavior'],
      },
      density: { mean: 0.3, sd: 0.1, confidence: 0.6, sources: ['preference'] },
    },
    confidence: 0.7,
  };
}

const FORBIDDEN =
  /\b(normal|disabilit\w*|impair\w*|patient|diagnos\w*|symptom\w*|low vision|adhd|tremor|test|score|results?|assessment|acuity|below average|fix\w*|compliant|conform\w*)\b|!/i;

function allText(rows: readonly FitRow[]): string[] {
  return rows.flatMap((r) => [
    r.label,
    r.before,
    r.after,
    r.srText,
    r.sentence,
    r.source,
  ]);
}

describe('fitRows', () => {
  it('lists the ten rows in display order', () => {
    expect(fitRows(base()).map((r) => r.label)).toEqual([
      'Text size',
      'Contrast',
      'Light or dark',
      'Line spacing',
      'Line length',
      'Click targets',
      'Steady clicks',
      'Menus stay open',
      'Moving things',
      'Busy areas',
    ]);
  });

  it('shows browser defaults against the default fit without inventing changes', () => {
    const rows = fitRows(base());
    const text = rows.find((r) => r.id === 'textSize');
    expect(text).toMatchObject({
      before: `16${NBSP}px`,
      after: `16${NBSP}px`,
      changed: false,
      source: 'Default',
    });
    expect(text?.srText).toBe('as the site made it');
    expect(text?.changesPages).toBe(false);
    // Nothing measured and no system setting: the default fit changes nothing.
    const motion = rows.find((r) => r.id === 'motion');
    expect(motion).toMatchObject({ changed: false, changesPages: false });
    expect(rows.every((r) => !r.changesPages)).toBe(true);
    expect(rows.every((r) => r.value.kind === 'same' && !r.changed)).toBe(true);
  });

  it('never invents a before value', () => {
    const rows = fitRows(fitted(), undefined, { browserDefaultPx: 18 });
    const values = Object.fromEntries(rows.map((r) => [r.id, r.value]));
    // Text size is a real change from the browser's own size.
    expect(values.textSize).toEqual({
      kind: 'change',
      before: 18,
      after: 19,
      unit: 'px',
      srText: '18 to 19 pixels',
    });
    // Minimums WebAble enforces, with no made-up starting point.
    expect(values.contrast).toEqual({
      kind: 'floor',
      after: '7:1',
      srText: 'at least 7 to 1',
    });
    expect(values.targets).toEqual({
      kind: 'floor',
      after: 56,
      unit: 'px',
      srText: 'at least 56 pixels',
    });
    expect(values.lineSpacing).toEqual({
      kind: 'floor',
      after: 1.8,
      srText: 'at least 1.8',
    });
    expect(values.hoverGrace).toMatchObject({ kind: 'floor', after: 400 });
    expect(values.lineLength).toEqual({
      kind: 'word',
      after: `Up to 70${NBSP}characters`,
      srText: 'up to 70 characters',
    });
    // Settings in words, against what sites do on their own.
    expect(values.polarity).toEqual({
      kind: 'word',
      before: 'Site colors',
      after: 'Dark',
      srText: 'from site colors to dark pages',
    });
    expect(values.motion).toMatchObject({ before: 'Plays', after: 'Paused' });
    expect(values.busyPages).toMatchObject({
      kind: 'word',
      after: 'Simplified',
    });
    for (const r of rows) {
      expect(r.srText).toBe(r.value.srText);
      for (const invented of ['4.5:1', `24${NBSP}px`, `80${NBSP}characters`])
        expect(r.before).not.toBe(invented);
      expect(r.before).not.toMatch(/^0\u00a0ms$/);
    }
    // Rows WebAble leaves alone say so.
    const plain = base();
    plain.vision.maxLineCh = { value: 80, source: 'default', confidence: 0.5 };
    const same = fitRows(plain).find((r) => r.id === 'lineLength');
    expect(same?.value).toEqual({
      kind: 'same',
      srText: 'as the site made it',
    });
    expect(fitRows(plain).find((r) => r.id === 'hoverGrace')?.value.kind).toBe(
      'same',
    );
  });

  it('describes a measured fit with fit marks, sources and confidence', () => {
    const rows = fitRows(fitted(), undefined, { now: NOW });
    const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
    expect(byId.textSize).toMatchObject({
      before: `16${NBSP}px`,
      after: `19${NBSP}px`,
      srText: '16 to 19 pixels',
      sentence: `Text reads best for you at 19${NBSP}px or larger.`,
      source: 'Measured today',
      confidence: 'high',
      changesPages: true,
    });
    expect(byId.contrast).toMatchObject({
      after: '7:1',
      confidence: 'medium',
      changesPages: true,
    });
    expect(byId.polarity).toMatchObject({
      after: 'Dark',
      sentence: 'Light text on a dark background reads faster for you.',
    });
    expect(byId.lineSpacing).toMatchObject({
      after: '1.8',
      confidence: 'low',
      changesPages: true,
    });
    expect(byId.lineLength).toMatchObject({
      after: `70${NBSP}characters`,
      srText: 'up to 70 characters',
    });
    expect(byId.targets).toMatchObject({
      after: `56${NBSP}px`,
      sentence: `Click areas grow up to 56${NBSP}px where there’s room.`,
      changesPages: true,
    });
    expect(byId.steadyClicks).toMatchObject({
      before: 'Off',
      after: 'On',
      confidence: 'high',
    });
    expect(byId.hoverGrace).toMatchObject({
      after: `400${NBSP}ms`,
      confidence: 'low',
    });
    expect(byId.motion).toMatchObject({
      after: 'Paused',
      source: 'Measured today',
      confidence: 'high',
    });
    expect(byId.busyPages).toMatchObject({
      after: 'Simplified',
      changesPages: true,
    });
  });

  it('shows the recalibration diff against the previous fit', () => {
    const previous = fitted();
    const next = fitted();
    next.motor.minTargetPx = {
      value: 72,
      source: 'measured',
      confidence: 0.7,
      measured: 72,
    };
    const rows = fitRows(next, previous, { now: NOW });
    expect(rows.find((r) => r.id === 'targets')).toMatchObject({
      before: `56${NBSP}px`,
      after: `72${NBSP}px`,
      changed: true,
      value: {
        kind: 'change',
        before: 56,
        after: 72,
        unit: 'px',
        srText: '56 to 72 pixels',
      },
    });
    // Unchanged rows show this fit, not a diff.
    expect(rows.find((r) => r.id === 'textSize')).toMatchObject({
      changed: false,
      value: { kind: 'change', before: 16, after: 19 },
    });
    // Settings in words keep the previous word as their before.
    next.vision.polarity = {
      value: 'none',
      source: 'override',
      confidence: 0.9,
      override: 'none',
    };
    expect(
      fitRows(next, previous).find((r) => r.id === 'polarity')?.value,
    ).toEqual({
      kind: 'word',
      before: 'Dark',
      after: 'Site colors',
      srText: 'from dark pages to site colors',
    });
  });

  it('labels where each value came from', () => {
    const p = fitted();
    p.vision.textMinPx = {
      value: 24,
      source: 'override',
      confidence: 0.9,
      override: 24,
      measured: 19,
    };
    p.vision.contrastFloor = {
      value: 7,
      source: 'system',
      confidence: 0.5,
      stated: 7,
    };
    p.motor.minTargetPx = { value: 44, source: 'learned', confidence: 0.7 };
    p.attention.motion = {
      mean: 0.6,
      sd: 0.15,
      confidence: 0.6,
      sources: ['system'],
    };
    p.attention.systemReducedMotion = true;
    const rows = Object.fromEntries(
      fitRows(p, undefined, { now: NOW }).map((r) => [r.id, r]),
    );
    expect(rows.textSize).toMatchObject({
      source: 'Set by you',
      sourceKind: 'override',
      sentence: `You set text to 24${NBSP}px or larger.`,
    });
    expect(rows.contrast?.source).toBe('Your system setting');
    expect(rows.targets?.source).toBe('Learned as you browse');
    expect(rows.motion).toMatchObject({ source: 'Your system setting' });
    expect(rows.motion?.sentence).toContain('Your device asks for less motion');
    const later = Object.fromEntries(
      fitRows(fitted(), undefined, {
        now: new Date('2026-10-14T09:00:00Z'),
      }).map((r) => [r.id, r]),
    );
    expect(later.lineSpacing?.source).toBe('Measured Sep 29');
    // Answers to Tune's questions are not measurements.
    const answered = fitted();
    answered.attention.motion = {
      mean: 0.5,
      sd: 0.1,
      confidence: 0.7,
      sources: ['preference', 'chips'],
    };
    expect(
      fitRows(answered, undefined, { now: NOW }).find((r) => r.id === 'motion'),
    ).toMatchObject({
      source: 'From your answers in Tune',
      sourceKind: 'answered',
    });
  });

  it('says a small floor still fits most pages', () => {
    const p = base();
    p.vision.textMinPx = {
      value: 13,
      source: 'measured',
      confidence: 0.85,
      measured: 13,
    };
    const row = fitRows(p).find((r) => r.id === 'textSize');
    expect(row).toMatchObject({ after: `16${NBSP}px`, changesPages: false });
    expect(row?.sentence).toBe(
      `Text reads well for you at 13${NBSP}px or larger, so most pages already fit.`,
    );
  });

  it('follows the copy rules in every row', () => {
    const profiles = [
      base(),
      fitted(),
      defaultFitProfile(
        { ...DEFAULT_SYSTEM_SIGNALS, reducedMotion: true, moreContrast: true },
        NOW,
      ),
    ];
    const extreme = fitted();
    extreme.vision.contrastFloor = {
      value: 21,
      source: 'measured',
      confidence: 0.6,
    };
    extreme.vision.polarity = {
      value: 'light',
      source: 'stated',
      confidence: 0.5,
      stated: 'light',
    };
    extreme.attention.distraction = {
      mean: 0.1,
      sd: 0.2,
      confidence: 0.3,
      sources: ['behavior'],
    };
    extreme.attention.density = {
      mean: 0,
      sd: 0.3,
      confidence: 0.1,
      sources: [],
    };
    profiles.push(extreme);
    for (const p of profiles) {
      const rows = fitRows(p, profiles[0], { now: NOW });
      for (const text of allText(rows)) {
        expect(text).not.toMatch(FORBIDDEN);
        expect(text.length).toBeGreaterThan(0);
      }
      for (const r of rows) {
        expect(r.sentence).toMatch(/^[A-Z]/);
        expect(r.sentence.endsWith('.')).toBe(true);
        expect(r.sentence.split(/\s+/).length).toBeLessThanOrEqual(20);
        expect(r.sentence).not.toMatch(/\d px|\d ms/);
      }
    }
    const rows = Object.fromEntries(fitRows(extreme).map((r) => [r.id, r]));
    expect(rows.contrast?.after).toBe('Maximum');
    expect(rows.polarity?.sentence).toBe(
      'You chose dark text on a light background.',
    );
    expect(rows.busyPages).toMatchObject({
      after: 'Ask first',
      changesPages: false,
    });
  });
});

describe('fitUiVars', () => {
  it('leaves the UI at its defaults for the default fit', () => {
    expect(fitUiVars(base())).toEqual({
      style: {
        '--wa-text-scale': '1',
        '--wa-target-min': '44px',
        '--wa-leading-add': '0',
        '--wa-space-scale': '1',
      },
      attributes: {},
    });
  });

  it('scales the UI from a measured fit', () => {
    const vars = fitUiVars(fitted());
    expect(vars.style['--wa-text-scale']).toBe('1.188');
    expect(vars.style['--wa-target-min']).toBe('56px');
    expect(vars.style['--wa-leading-add']).toBe('0.3');
    expect(vars.style['--wa-space-scale']).toBe('1.25');
    expect(vars.attributes['data-wa-motion']).toBe('reduce');
    const slips = fitted();
    slips.vision.lineHeight = {
      value: 1.5,
      source: 'default',
      confidence: 0.5,
    };
    slips.motor.targetSpacingPx = {
      value: 80,
      source: 'measured',
      confidence: 0.6,
    };
    expect(fitUiVars(slips).style['--wa-space-scale']).toBe('1.5');
  });

  it('clamps the text scale to 1..2 and honours the system motion setting', () => {
    const big = fitted();
    big.vision.textMinPx = { value: 60, source: 'measured', confidence: 0.7 };
    expect(fitUiVars(big).style['--wa-text-scale']).toBe('2');
    const reduced = defaultFitProfile(
      { ...DEFAULT_SYSTEM_SIGNALS, reducedMotion: true },
      NOW,
    );
    expect(fitUiVars(reduced).attributes).toEqual({
      'data-wa-motion': 'reduce',
    });
  });
});
