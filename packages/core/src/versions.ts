/**
 * Every artifact WebAble persists or exchanges carries the version of the
 * logic that produced it, so later learning can separate "the person changed"
 * from "WebAble changed".
 */

/** Measurement summaries -> fit profile derivation. */
export const DERIVATION_VERSION = 'fit-1.0.0' as const;

/** Adaptation op library (ids, levels, risk classes). */
export const OP_LIBRARY_VERSION = 'ops-2.0.0' as const;

/** Learning state and policy parameters. */
export const LEARNING_VERSION = 'learn-1.0.0' as const;

/** Page-analysis question catalog sent to Jev (server-side only). */
export const CATALOG_VERSION = 'wa-cat-1.0.0' as const;

/** Thresholds are calibrated per model version, so the model is pinned. */
export const JEV_PINNED_MODEL = 'jev-1.13.0' as const;

/** Person-relative triage (fits / tailor / compose). */
export const TRIAGE_VERSION = 'triage-1.0.0' as const;

/** Fit view layout rules (fit profile -> FitLayout). */
export const FIT_SOLVER_VERSION = 'fitlayout-1.1.0' as const;
