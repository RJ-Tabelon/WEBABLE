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
