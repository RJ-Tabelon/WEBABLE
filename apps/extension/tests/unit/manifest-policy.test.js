import { describe, expect, it } from 'vitest';
import { validateManifest } from '../../../../scripts/manifest-policy.mjs';

const manifest = () => ({
  manifest_version: 3,
  permissions: ['scripting', 'activeTab'],
  action: { default_popup: 'popup.html' },
  background: { service_worker: 'background.js', type: 'module' },
});

describe('production permission boundary', () => {
  it('accepts the least-privilege runtime-injection manifest', () => {
    expect(() => validateManifest(manifest())).not.toThrow();
  });
  it.each([
    { manifest_version: 2 },
    { permissions: ['activeTab', 'scripting', 'tabs'] },
    { permissions: ['activeTab'] },
    { host_permissions: ['<all_urls>'] },
    { optional_host_permissions: ['<all_urls>'] },
    { content_scripts: [{ matches: ['<all_urls>'], js: ['engine.js'] }] },
    { background: { service_worker: 'background.js' } },
    { action: {} },
  ])('rejects unsafe or incomplete production settings: %j', (patch) => {
    expect(() => validateManifest({ ...manifest(), ...patch })).toThrow();
  });
});
