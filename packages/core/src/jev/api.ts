/**
 * TypeSafe AI "System One" API types (POST https://api.typesafe.ai/v1/systemone).
 * Matches the documented contract and OpenAPI 0.2.0 as captured 2026-09-28.
 * Jev returns typed probabilities over options WebAble wrote; it never generates text.
 */

export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

/** Used by `instructions`, Choice option descriptions, and Noul true/false criteria. */
export type JevEntry =
  string | { [key: string]: JsonValue } | JsonValue[] | null;
export type JevLevel = string | { [key: string]: JsonValue } | JsonValue[];
/** A bare number or boolean is rejected with 422. */
export type JevState = string | { [key: string]: JsonValue } | JsonValue[];

export interface JevNoulQuestion {
  type: 'noul';
  instructions?: JevEntry;
  criteria?: { true?: JevEntry; false?: JevEntry } | null;
}

export interface JevChoiceQuestion<O extends string = string> {
  type: 'choice';
  instructions?: JevEntry;
  /** Option name -> description (null = self-explanatory). At most 255 options. */
  criteria: Record<O, JevEntry>;
}

export interface JevScoreQuestion {
  type: 'score';
  instructions?: JevEntry;
  /** Ordered low -> high, 2 to 10 levels. */
  criteria: [JevLevel, JevLevel, ...JevLevel[]];
}

export type JevQuestion =
  JevNoulQuestion | JevChoiceQuestion | JevScoreQuestion;

export type JevModelId = 'jev-1.13.0' | 'jev-latest' | 'jev-preview';

export interface JevRequest<
  Q extends Record<string, JevQuestion> = Record<string, JevQuestion>,
> {
  state: JevState;
  model: JevModelId;
  /** Keys are ours and are not sent to the model. */
  questions: Q;
}

export interface JevNoulAnswer {
  type: 'noul';
  /** P(yes) in [0, 1]. No confidence field. */
  noul: number;
}

export interface JevChoiceAnswer<O extends string = string> {
  type: 'choice';
  choice: O;
  /** Derived from probabilities; never thresholded by WebAble. */
  confidence: number;
  probabilities: Record<O, number>;
}

export interface JevScoreAnswer {
  type: 'score';
  score: number;
  confidence: number;
  legend: Record<string, JevLevel>;
  probabilities: Record<string, number>;
}

export type JevAnswer = JevNoulAnswer | JevChoiceAnswer | JevScoreAnswer;

export interface JevUsage {
  input_tokens: number;
  output_tokens: number;
}

export interface JevResponse {
  model: string;
  answers: Record<string, JevAnswer>;
  usage: JevUsage;
}

export const JEV_ENDPOINT = 'https://api.typesafe.ai/v1/systemone';
export const JEV_REQUEST_ID_HEADER = 'x-typesafe-request-id';

export type JevFailure =
  | { kind: 'timeout' }
  | { kind: 'network' }
  | { kind: 'rate_limited'; retryAfterMs?: number }
  | { kind: 'overloaded' }
  | { kind: 'auth'; status: 401 | 403 }
  | { kind: 'invalid'; status: 400 | 422; body: unknown }
  | { kind: 'server'; status: number }
  | { kind: 'aborted' }
  | { kind: 'shape'; issue: string }
  | { kind: 'model_drift'; got: string };

export type JevResult =
  | { ok: true; data: JevResponse; requestId: string | null; ms: number }
  | { ok: false; error: JevFailure; requestId: string | null; ms: number };
