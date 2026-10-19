import type { RegionEvidence } from './types';
import { VOCAB_V1_WORDS } from './vocab-list';

/**
 * VOCAB_V1: a bundled, reviewed, public list of ~1,500 lowercase English UI and
 * web-structure words. Health, finance, religion, sexuality and politics terms,
 * and all proper nouns, are excluded. Only these words can leave the device,
 * so the set of possible page-analysis payload strings is enumerable.
 */
export const VOCAB_V1: ReadonlySet<string> = new Set<string>(VOCAB_V1_WORDS);

/** Marker for a run of one or more words that were not in the vocabulary. */
export const DROPPED_MARK = '·';

/** Default cap on vocabulary words per label. */
export const VOCAB_MAX_WORDS = 6;

/** Longest input tokenized; labels are short, and this bounds work on hostile pages. */
export const MAX_TOKENIZE_CHARS = 4096;

const MIN_TOKEN = 2;
const MAX_TOKEN = 20;

/** Split on non-letters and camelCase, lowercase, keep 2-20 letter tokens. */
export function tokenize(text: string): string[] {
  if (typeof text !== 'string' || text.length === 0) return [];
  const source =
    text.length > MAX_TOKENIZE_CHARS ? text.slice(0, MAX_TOKENIZE_CHARS) : text;
  const spaced = source
    // Possessive or "is" contraction: "Today's" -> "Today", "it's" -> "it".
    .replace(/['’]s\b/gi, '')
    // Other contractions join: "don't" -> "dont", "you're" -> "youre".
    .replace(/([A-Za-z])['’]([A-Za-z])/g, '$1$2')
    // camelCase and acronym boundaries: "RelatedLinks" -> "Related Links", "HTMLElement" -> "HTML Element".
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  const tokens: string[] = [];
  for (const part of spaced.split(/[^A-Za-z]+/)) {
    if (part.length < MIN_TOKEN || part.length > MAX_TOKEN) continue;
    tokens.push(part.toLowerCase());
  }
  return tokens;
}

export function isVocabWord(word: string): boolean {
  return typeof word === 'string' && VOCAB_V1.has(word);
}

/**
 * Keep only vocabulary words, collapse runs of dropped tokens to a single '·',
 * cap at `max` words. "Welcome back, Caden" -> ["welcome", "back", "·"].
 * The cap counts vocabulary words; a '·' is never emitted after the cap is reached.
 */
export function vocabFilter(
  text: string,
  max: number = VOCAB_MAX_WORDS,
): string[] {
  const limit = Math.max(0, Math.floor(max));
  const out: string[] = [];
  if (limit === 0) return out;
  let kept = 0;
  let lastDropped = false;
  for (const token of tokenize(text)) {
    if (kept >= limit) break;
    if (VOCAB_V1.has(token)) {
      out.push(token);
      kept += 1;
      lastDropped = false;
    } else if (!lastDropped) {
      out.push(DROPPED_MARK);
      lastDropped = true;
    }
  }
  return out;
}

/**
 * Vocabulary words joined by single spaces, for `heading_words` and each
 * `control_words` entry. "Welcome back, Caden" -> "welcome back ·".
 */
export function vocabPhrase(
  text: string,
  max: number = VOCAB_MAX_WORDS,
): string {
  return vocabFilter(text, max).join(' ');
}

/**
 * Unique vocabulary words with no '·' markers, for `class_words` (tokenized id
 * and class names). "nyt-RelatedLinks css-1x9k2" -> ["related", "links"].
 */
export function vocabClassWords(
  text: string,
  max: number = VOCAB_MAX_WORDS,
): string[] {
  const limit = Math.max(0, Math.floor(max));
  const out: string[] = [];
  for (const token of tokenize(text)) {
    if (out.length >= limit) break;
    if (VOCAB_V1.has(token) && !out.includes(token)) out.push(token);
  }
  return out;
}

/** True when every space-separated token is a vocabulary word or '·' (server-side re-validation). */
export function isVocabPhrase(phrase: string): boolean {
  if (typeof phrase !== 'string') return false;
  if (phrase === '') return true;
  return phrase
    .split(' ')
    .every((token) => token === DROPPED_MARK || VOCAB_V1.has(token));
}

/**
 * Every string in a region's evidence that is not vocabulary (empty when clean).
 * The Edge Function rejects a request with 422 when this is non-empty.
 */
export function unknownEvidenceWords(
  ev: Pick<RegionEvidence, 'class_words' | 'heading_words' | 'control_words'>,
): string[] {
  const bad: string[] = [];
  for (const word of ev.class_words) if (!VOCAB_V1.has(word)) bad.push(word);
  for (const phrase of [ev.heading_words, ...ev.control_words]) {
    if (phrase === '') continue;
    for (const token of phrase.split(' ')) {
      if (token !== DROPPED_MARK && !VOCAB_V1.has(token)) bad.push(token);
    }
  }
  return bad;
}
