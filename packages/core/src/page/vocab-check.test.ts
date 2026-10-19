import { describe, expect, it } from 'vitest';

import type { RegionEvidence } from './types';
import {
  MAX_CONTROL_WORDS,
  MAX_HEADING_WORDS,
  vocabularyViolations,
} from './vocab-check';

type Words = Pick<
  RegionEvidence,
  'class_words' | 'heading_words' | 'control_words'
>;

const ev = (over: Partial<Words> = {}): Words => ({
  class_words: ['nav', 'menu'],
  heading_words: 'most popular',
  control_words: ['sign in'],
  ...over,
});

describe('vocabularyViolations', () => {
  it('passes clean evidence', () => {
    expect(vocabularyViolations(ev())).toBe(0);
  });

  it('counts unknown words', () => {
    expect(vocabularyViolations(ev({ class_words: ['zzqx', 'qqzz'] }))).toBe(2);
    expect(
      vocabularyViolations(ev({ heading_words: 'welcome back caden' })),
    ).toBeGreaterThan(0);
  });

  it('does not count dropped-word marks', () => {
    expect(vocabularyViolations(ev({ heading_words: '·' }))).toBe(0);
    expect(vocabularyViolations(ev({ heading_words: 'most · popular' }))).toBe(
      0,
    );
  });

  it('caps words per phrase', () => {
    const six = Array.from({ length: MAX_HEADING_WORDS }, () => 'menu').join(
      ' ',
    );
    expect(vocabularyViolations(ev({ heading_words: six }))).toBe(0);
    expect(vocabularyViolations(ev({ heading_words: `${six} ·` }))).toBe(0);
    expect(vocabularyViolations(ev({ heading_words: `${six} menu` }))).toBe(1);
    const four = Array.from({ length: MAX_CONTROL_WORDS }, () => 'menu').join(
      ' ',
    );
    expect(vocabularyViolations(ev({ control_words: [four] }))).toBe(0);
    expect(vocabularyViolations(ev({ control_words: [`${four} menu`] }))).toBe(
      1,
    );
  });
});
