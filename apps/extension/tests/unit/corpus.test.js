import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Vitest runs from apps/extension.
const corpusPath = resolve(process.cwd(), '../../eval/corpus/sites.json');
const corpus = JSON.parse(readFileSync(corpusPath, 'utf8'));

const CATEGORIES = [
  'news',
  'shopping',
  'government',
  'government-forms',
  'banking-demo',
  'controlled',
  'spa',
];

describe('real-site test corpus', () => {
  it('uses unique ids', () => {
    const ids = corpus.sites.map((site) => site.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every site the required fields', () => {
    for (const site of corpus.sites) {
      expect(site.id).toMatch(/^[a-z0-9-]+$/);
      expect(CATEGORIES).toContain(site.category);
      expect(new URL(site.url).protocol).toBe('https:');
      expect(site.why.length).toBeGreaterThan(0);
      expect(site.pages.length).toBeGreaterThan(0);
      site.pages.forEach((page) => expect(page.startsWith('/')).toBe(true));
    }
  });

  it('covers news, shopping, government forms and a banking demo', () => {
    const categories = new Set(corpus.sites.map((site) => site.category));
    for (const required of [
      'news',
      'shopping',
      'government-forms',
      'banking-demo',
    ]) {
      expect(categories.has(required)).toBe(true);
    }
  });
});
