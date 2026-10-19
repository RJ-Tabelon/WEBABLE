import { DERIVATION_VERSION } from '../versions';
import type { DeviceClass, FitProfile, InputClass, LatentDim } from './schema';

/** What the browser tells us before any calibration. Nothing here identifies a person. */
export interface SystemSignals {
  reducedMotion: boolean;
  colorScheme: 'light' | 'dark';
  moreContrast: boolean;
  forcedColors: boolean;
  deviceClass: DeviceClass;
  input: InputClass;
}

export const DEFAULT_SYSTEM_SIGNALS: SystemSignals = {
  reducedMotion: false,
  colorScheme: 'light',
  moreContrast: false,
  forcedColors: false,
  deviceClass: 'laptop',
  input: 'mouse',
};

const flat = (mean: number, sd = 0.35): LatentDim => ({
  mean,
  sd,
  confidence: 0,
  sources: [],
});

/**
 * The zero-setup profile. It changes nothing a typical reader would notice,
 * except where the operating system already expressed a preference.
 */
export function defaultFitProfile(
  system: SystemSignals = DEFAULT_SYSTEM_SIGNALS,
  now: Date = new Date(),
): FitProfile {
  return {
    v: 1,
    derivationVersion: DERIVATION_VERSION,
    calibrationVersion: null,
    createdAt: now.toISOString(),
    device: { class: system.deviceClass, input: system.input },
    modules: { reading: 'not_run', pointing: 'not_run', focus: 'not_run' },
    vision: {
      textMinPx: { value: 16, source: 'default', confidence: 0.3 },
      contrastFloor: system.moreContrast
        ? { value: 7, source: 'system', confidence: 0.5, stated: 7 }
        : { value: 4.5, source: 'default', confidence: 0.4 },
      polarity: { value: 'none', source: 'default', confidence: 0.3 },
      fontWeightFloor: { value: 400, source: 'default', confidence: 0.8 },
      lineHeight: { value: 1.5, source: 'default', confidence: 0.5 },
      wordSpacingEm: { value: 0, source: 'default', confidence: 0.35 },
      letterSpacingEm: { value: 0, source: 'default', confidence: 0.6 },
      maxLineCh: { value: 80, source: 'default', confidence: 0.4 },
    },
    motor: {
      input: system.input,
      minTargetPx: { value: 24, source: 'default', confidence: 0.3 },
      targetSpacingPx: { value: 24, source: 'default', confidence: 0.3 },
      steadyClicks: {
        value: { on: false, windowMs: 300, radiusPx: 8 },
        source: 'default',
        confidence: 0.3,
      },
      repeatGuard: {
        value: { on: false, windowMs: 400 },
        source: 'default',
        confidence: 0.3,
      },
      drag: { value: 'none', source: 'default', confidence: 0.3 },
      hoverGraceMs: { value: 0, source: 'default', confidence: 0.3 },
    },
    attention: {
      motion: system.reducedMotion
        ? { mean: 0.6, sd: 0.15, confidence: 0.6, sources: ['system'] }
        : flat(0),
      distraction: flat(0),
      density: flat(0),
      chunking: flat(0),
      guidance: flat(0),
      systemReducedMotion: system.reducedMotion,
    },
    confidence: 0,
  };
}
