import path from 'node:path';
import { fileURLToPath } from 'node:url';
import AxeBuilder from '@axe-core/playwright';
import { chromium, expect, test } from '@playwright/test';

const extensionPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../.output/chrome-mv3-e2e',
);

test('loads the service worker, accessible popup, and runtime content bundle', async () => {
  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    headless: true,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });
  try {
    const worker =
      context.serviceWorkers()[0] ??
      (await context.waitForEvent('serviceworker'));
    const id = new URL(worker.url()).host;
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${id}/popup.html`);
    await expect(popup.getByRole('heading', { name: 'WebAble' })).toBeVisible();
    await expect(
      popup.getByText('Website adaptations are coming soon.'),
    ).toBeVisible();
    const audit = await new AxeBuilder({ page: popup })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(audit.violations).toEqual([]);

    const page = await context.newPage();
    await page.goto('http://127.0.0.1:4173');
    const result = await worker.evaluate(async () => {
      const tabs = await chrome.tabs.query({ url: 'http://127.0.0.1:4173/*' });
      const tabId = tabs[0]?.id;
      if (tabId == null) throw new Error('Fixture tab not found');
      return chrome.scripting.executeScript({
        target: { tabId },
        files: ['content-scripts/engine.js'],
      });
    });
    expect(result[0]?.result).toEqual({ ready: true });
    await expect(
      page.getByRole('heading', { name: 'Fixture page' }),
    ).toBeVisible();
  } finally {
    await context.close();
  }
});
