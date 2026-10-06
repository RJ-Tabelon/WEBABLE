import { defineConfig } from 'wxt';

// WXT uses Vite and generates manifest.json from this config and entrypoints.
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: ({ mode }) => ({
    name: 'WebAble',
    description: 'User-controlled website adaptations.',
    permissions: ['activeTab', 'scripting'],
    // Only the test build receives permanent access to its local fixture.
    host_permissions: mode === 'e2e' ? ['http://127.0.0.1:4173/*'] : undefined,
    action: { default_title: 'WebAble' },
  }),
});
