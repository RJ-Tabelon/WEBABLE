/**
 * JavaScript mirror of values that must exist outside CSS
 * (toolbar icon and badge colours, motion timing in scripts, ladders).
 * Keep in sync with tokens.css.
 */
export const color = {
  light: {
    canvas: '#FAFAF7',
    ink: '#1A1A17',
    ink2: '#45443E',
    ink3: '#5E5D56',
    lineStrong: '#7D7C73',
    accent: '#2D6A3E',
    surfaceTonal: '#F2F1EC',
  },
  dark: {
    canvas: '#141412',
    ink: '#EDECE6',
    ink2: '#C9C8BF',
    ink3: '#A4A399',
    lineStrong: '#85847B',
    accent: '#8FCB9B',
    surfaceTonal: '#232320',
  },
  /** Fixed in both themes. */
  stage: '#FFFFFF',
  stimulus: '#111111',
  inpageAccent: '#2D6A3E',
  inpageCasing: '#FFFFFF',
  badgeAccent: '#2D6A3E',
  badgeWarn: '#F0B45C',
  tileInk: '#1A1A17',
  tileMuted: '#7D7C73',
} as const;

export const motion = {
  dur1: 100,
  dur2: 160,
  dur3: 220,
  dur3Exit: 150,
  dur4: 300,
  dur4Exit: 210,
  draw: 600,
  delayStatus: 300,
  delayTooltip: 500,
  loopAnalyzing: 1000,
  stopAnalyzing: 5000,
  ease: 'cubic-bezier(0.22, 0.8, 0.26, 1)',
  easeExit: 'cubic-bezier(0.4, 0, 1, 1)',
} as const;

export const size = {
  textFloorPx: 15,
  targetMinPx: 44,
  controlLgPx: 48,
  controlTaskPx: 64,
  rowMinPx: 56,
  popupWidthRem: 23.75,
  popupMaxHeightPx: 600,
} as const;
