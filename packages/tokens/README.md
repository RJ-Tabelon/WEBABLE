# @webable/tokens

Shared design tokens for WebAble's website, app, calibration flow, extension
popup, and in-page layer. The system covers semantic light and dark colors;
4 px-based spacing and profile-adjustable stack gaps; WebAble Sans and Mono
typefaces, type sizes, weights, leading, and tracking; and motion durations,
delays, easing, and reduced-motion settings. It also defines layout widths,
controls, radii, elevation, focus, and layer-order tokens.

## Importing the CSS

Import these styles once in the application's entry point, in this order:

```ts
import '@webable/tokens/fonts.css';
import '@webable/tokens/tokens.css';
import '@webable/tokens/base.css';
```

`tokens.css` defines the custom properties and theme behavior.
`fonts.css` loads the self-hosted WebAble Sans and Mono fonts; omit it in
surfaces that must use system fonts, such as the in-page layer. `base.css`
provides shared element styles and expects `tokens.css` to be loaded first.
When using `@webable/ui`, load `@webable/ui/styles.css` after these files.

The default theme follows the operating-system color preference. Set
`data-theme="light"` or `data-theme="dark"` to pin a theme; the attribute can
also scope a theme to a subtree. Reduced motion, increased contrast, reduced
transparency, and forced-colors preferences are handled in the token styles.

For values needed in JavaScript, import `color`, `motion`, or `size` from
`@webable/tokens`. They mirror selected CSS values; keep additions and changes
in sync with `tokens.css`.

## Naming conventions

- CSS custom properties use lowercase, hyphen-separated names. Most are
  semantic and unprefixed: colors such as `--canvas`, `--ink-2`, and
  `--surface-raised`; typography roles such as `--font-sans`, `--text-body`,
  and `--leading-body`; and layout roles such as `--w-content`.
- Numbered families indicate scale or role: `--space-1` is 4 px,
  `--space-2` is 8 px, and `--dur-1` through `--dur-4` are motion durations.
  Prefer these shared tokens to copying literal values.
- Profile hooks use the `--wa-` prefix, for example `--wa-text-scale`,
  `--wa-target-min`, `--wa-leading-add`, and `--wa-space-scale`. They adjust
  token values without replacing the semantic names components consume.
- JavaScript mirrors use camelCase (`color`, `motion`, `size` and their
  properties). CSS uses kebab-case; theme-specific color values resolve
  through the same semantic custom property names.
