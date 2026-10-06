# WebAble

Chrome extension for user-controlled website adaptations. This initial foundation adapts the WXT/Vite + React structure from [WEBABLE-PROTOYPE](https://github.com/RJ-Tabelon/WEBABLE-PROTOYPE), main commit `8e2d6172608f688763f49bf4ce5e74a101dab865`. The adaptation engine, web app, profiles and backend belong in subsequent feature work.

## Local development

Install Node.js 24+ and pnpm 10.31.0, then run:

```sh
pnpm install
pnpm dev:extension
```

WXT starts a development browser with the extension loaded.

For a production build:

```sh
pnpm build
pnpm extension:check
pnpm typecheck
```

Open Chrome's `chrome://extensions`, enable **Developer mode**, select **Load unpacked**, and choose `apps/extension/.output/chrome-mv3`. Pin WebAble and open the popup. After rebuilding, press **Reload** on the extension card.

## Structure and manifest

- `apps/extension/`: WXT entrypoints, popup and TypeScript configuration.
- `scripts/`: production package and permission checks.
- `docs/manifest.json`: reference MV3 skeleton; the actual manifest is generated in the build output.

WXT uses Vite for bundling and generates the popup and module service worker entries. `engine.content.ts` becomes `content-scripts/engine.js`. Like the prototype, it uses runtime registration; `content_scripts` is empty and production has no permanent host access. Later feature PRs can inject the script through `scripting` after a toolbar action grants `activeTab`. The scaffold does not yet modify pages.

Dependencies are locked in `pnpm-lock.yaml`; use `pnpm install --frozen-lockfile` in reproducible builds.

## Contribution checks

```sh
pnpm format:check
pnpm lint
pnpm typecheck
```

See [Contributing](docs/CONTRIBUTING.md) for hooks, required review, and the **AI-generated code** PR convention.

## Testing and CI

Install Playwright's bundled Chromium once:

```sh
pnpm --filter @webable/extension exec playwright install chromium
pnpm verify
```

On Linux, use `playwright install --with-deps chromium` to include operating-system dependencies.

- `pnpm test`: Vitest + jsdom; permission and manifest boundary tests.
- `pnpm test:e2e`: builds an e2e extension, then Playwright verifies the service worker, popup, axe WCAG A/AA checks, and runtime content-script injection on a local fixture.
- `pnpm check`: formatting, lint, TypeScript and unit tests.
- `pnpm verify`: all checks, e2e, production build and package validation.

The e2e build grants access only to `http://127.0.0.1:4173/*`. Always load the production `chrome-mv3` directory for normal use; the package check rejects test host permissions.

CI runs **lint → typecheck → unit tests → e2e/axe → production build** and uploads `webable-chrome-mv3` only after success. On test failure it retains Playwright diagnostics. Download and extract the artifact, then choose the extracted directory containing `manifest.json` in Chrome's **Load unpacked** dialog.

The **CI / verify** check also enforces the PR's AI disclosure, title prefix and label. Automated axe checks are a baseline; they do not certify every accessibility requirement.
