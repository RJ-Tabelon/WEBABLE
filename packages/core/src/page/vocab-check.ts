import type { RegionEvidence } from './types';
import { DROPPED_MARK, unknownEvidenceWords } from './vocab';

/**
 * The vocabulary re-check both ends run on region evidence: the extension
 * before anything leaves the
 * device, and `decide` before anything reaches Jev. One implementation, so the
 * two can never disagree about what counts as free text.
 */

/** Vocabulary words per phrase; dropped-word marks do not count. */
export const MAX_HEADING_WORDS = 6;
export const MAX_CONTROL_WORDS = 4;

function wordCount(phrase: string): number {
  if (phrase === '') return 0;
  let n = 0;
  for (const token of phrase.split(' '))
    if (token !== DROPPED_MARK && token !== '') n += 1;
  return n;
}

/** Vocabulary violations in one evidence object: unknown words plus over-long phrases. */
export function vocabularyViolations(
  ev: Pick<RegionEvidence, 'class_words' | 'heading_words' | 'control_words'>,
): number {
  let violations = unknownEvidenceWords(ev).length;
  if (wordCount(ev.heading_words) > MAX_HEADING_WORDS) violations += 1;
  for (const phrase of ev.control_words)
    if (wordCount(phrase) > MAX_CONTROL_WORDS) violations += 1;
  return violations;
}
