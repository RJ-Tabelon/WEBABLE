import { configDefaults, defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing/vitest-plugin';

/**
 * Unit tests (vitest + jsdom) for pure logic across the extension. Browser
 * behaviour that needs real layout (the in-page engine's extraction, ops and
 * verification) is covered by the Playwright 'engine' project instead:
 * *.spec.ts files are never collected here.
 */
export default defineConfig({
  plugins: [WxtVitest()],
  test: {
    environment: 'jsdom',
    include: ['**/*.test.{ts,js}'],
    exclude: [
      ...configDefaults.exclude,
      '**/.output/**',
      '**/.wxt/**',
      '**/*.spec.ts',
      'tests/e2e/**',
    ],
  },
});
