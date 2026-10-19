import axe from 'axe-core';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Vitest runs from apps/extension.
const corpusDir = resolve(process.cwd(), '../../eval/corpus');
const { fixtures } = JSON.parse(
  readFileSync(resolve(corpusDir, 'fixtures.json'), 'utf8'),
);

async function countViolations(file) {
  const html = readFileSync(resolve(corpusDir, file), 'utf8');
  const doc = new globalThis.DOMParser().parseFromString(html, 'text/html');
  globalThis.document.documentElement.replaceWith(
    globalThis.document.importNode(doc.documentElement, true),
  );
  // jsdom has no layout, so skip rules that need rendering.
  const results = await axe.run(globalThis.document, {
    rules: { 'color-contrast': { enabled: false } },
  });
  return results.violations.length;
}

describe('paired corpus fixtures', () => {
  it.each(fixtures.map((fixture) => [fixture.id, fixture]))(
    '%s: after has fewer axe violations than before',
    async (_id, fixture) => {
      const before = await countViolations(fixture.before);
      const after = await countViolations(fixture.after);
      expect(before).toBeGreaterThan(0);
      expect(after).toBe(0);
    },
  );
});
