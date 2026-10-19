# @webable/ui

WebAble's shared React components. Import the package styles once, after the
token styles:

```ts
import '@webable/tokens/fonts.css';
import '@webable/tokens/tokens.css';
import '@webable/tokens/base.css';
import '@webable/ui/styles.css';
```

Interactive components are client components. In a Next.js app, wrap the
application in `LinkProvider` to route internal links; without it, links are
ordinary anchors.

## Foundations

### Icon

**Purpose:** Render an approved Lucide icon. **Key props:** `name` (from
`ICON_NAMES`), `size` (16, 20, or 24), optional `label`. **Accessibility:**
Decorative by default; supply a label only when the icon itself conveys meaning.

```tsx
import { Icon } from '@webable/ui';
<Icon name="settings" size={20} />
```

### CheckGlyph

**Purpose:** Small check glyph for controls. **Key props:** `size` (default 12),
`className`. **Accessibility:** Decorative and hidden from assistive technology.

```tsx
import { CheckGlyph } from '@webable/ui';
<CheckGlyph size={14} />
```

### FitArrow

**Purpose:** The brand arrow used between before-and-after values. **Key props:**
optional `size` and `className`. **Accessibility:** Decorative; provide the
meaningful value text separately.

```tsx
import { FitArrow } from '@webable/ui';
<FitArrow size={20} />
```

### Mark

**Purpose:** Render the WebAble measurement mark. **Key props:** `size`,
`tight`, optional `title`. **Accessibility:** Hidden by default; use `title`
when the standalone mark needs an accessible name.

```tsx
import { Mark } from '@webable/ui';
<Mark size={24} title="WebAble" />
```

### StatusShape

**Purpose:** Draw a status glyph. **Key props:** `state`, `size` (16 or 20).
**Accessibility:** Decorative; pair it with a visible status label.

```tsx
import { StatusShape } from '@webable/ui';
<StatusShape state="adapted" size={20} />
```

### Wordmark

**Purpose:** Display the WebAble wordmark, with or without its mark. **Key
props:** `withMark`, `glyphSize`, optional word as `children`. **Accessibility:**
The visible word supplies the name; the adjacent mark is decorative.

```tsx
import { Wordmark } from '@webable/ui';
<Wordmark withMark />
```

### LinkProvider

**Purpose:** Route internal links through the host application's router. **Key
props:** `component` (an anchor-rendering component), `children`.
**Accessibility:** The supplied component must render a real anchor and
preserve its accessible link behavior.

```tsx
import { LinkProvider } from '@webable/ui';
<LinkProvider component={AppLink}>{children}</LinkProvider>
```

### Anchor

**Purpose:** Render a link through `LinkProvider` for internal paths, or as a
native anchor otherwise. **Key props:** `href` and standard anchor props.
**Accessibility:** Use descriptive link text; external destinations remain
ordinary anchors.

```tsx
import { Anchor } from '@webable/ui';
<Anchor href="/settings">Settings</Anchor>
```

### OverlayContainer

**Purpose:** Choose where portalled overlays (such as tooltips) render. **Key
props:** `container` (an `Element` or `null`), `children`. **Accessibility:**
Useful for keeping overlays within a themed subtree or shadow root.

```tsx
import { OverlayContainer } from '@webable/ui';
<OverlayContainer container={overlayRoot}>{children}</OverlayContainer>
```

## Actions and links

### Actions

**Purpose:** Arrange a related row of buttons. **Key props:** `sizing`
(`natural` or `equal`), `children`. **Accessibility:** Keep the action order
meaningful; narrow layouts wrap or stack the actions.

```tsx
import { Actions, Button } from '@webable/ui';
<Actions sizing="equal"><Button>Keep</Button><Button>Cancel</Button></Actions>
```

### Button

**Purpose:** Render a pill button or button-styled link. **Key props:**
`variant`, `size`, `iconStart`, `iconEnd`, `href`, `busy`, `block`. **Accessibility:**
Use clear action text; disabled buttons stay focusable and announce their state.

```tsx
import { Button } from '@webable/ui';
<Button variant="primary" onClick={save}>Save changes</Button>
```

### IconButton

**Purpose:** Render a circular icon-only button. **Key props:** `icon`,
required `label`, `variant`, `size`, `tooltip`. **Accessibility:** Always
provide the accessible `label`; the tooltip is supplementary.

```tsx
import { IconButton } from '@webable/ui';
<IconButton icon="x" label="Close" onClick={close} />
```

### TextLink

**Purpose:** Render an underlined text link. **Key props:** `href`, `kind`
(`inline` or `standalone`), `external`. **Accessibility:** Use meaningful link
text; external links announce that they open in a new tab.

```tsx
import { TextLink } from '@webable/ui';
<TextLink href="/help">Read the help guide</TextLink>
```

## Inputs

### SwitchRow

**Purpose:** A labeled switch with optional supporting text. **Key props:**
`label`, `checked`/`defaultChecked`, `onCheckedChange`, `description`,
`disabledReason`, `changesPage`. **Accessibility:** Exposes switch semantics;
disabled reasons are announced via `aria-describedby`.

```tsx
import { SwitchRow } from '@webable/ui';
<SwitchRow label="WebAble on this site" checked={enabled} onCheckedChange={setEnabled} />
```

### Checkbox

**Purpose:** A labeled checkbox, including mixed state. **Key props:**
`children`, `checked`/`defaultChecked`, `onCheckedChange`, `indeterminate`,
`required`. **Accessibility:** Uses React Aria checkbox semantics; state the
required status in words in the label.

```tsx
import { Checkbox } from '@webable/ui';
<Checkbox checked={accepted} onCheckedChange={setAccepted}>I agree</Checkbox>
```

### SegmentedControl

**Purpose:** Choose among two to four short, exclusive options. **Key props:**
`options`, `label` or `labelledBy`, `value`/`defaultValue`,
`onValueChange`, `fill`. **Accessibility:** Radio-group semantics, roving
tabindex, and arrow/Home/End keyboard navigation are built in.

```tsx
import { SegmentedControl } from '@webable/ui';
<SegmentedControl label="Theme" options={themes} value={theme} onValueChange={setTheme} />
```

### Slider

**Purpose:** Select from an ordered ladder of numeric steps. **Key props:**
`label`, `steps`, `value`/`defaultValue`, `onValueChange`,
`onValueCommit`, `format`, `formatSpoken`. **Accessibility:** Includes
keyboard-operable slider semantics and labeled −/+ steppers as a non-drag
alternative.

```tsx
import { Slider } from '@webable/ui';
<Slider label="Text size" steps={[14, 16, 18, 21]} value={size} onValueChange={setSize} />
```

### Hint

**Purpose:** Display one line of supporting information or a reason. **Key
props:** `children`, optional `id`. **Accessibility:** Connect it to its
control with `aria-describedby`.

```tsx
import { Hint } from '@webable/ui';
<Hint id="email-hint">Use the address for your account.</Hint>
```

### TextField

**Purpose:** Labeled native text input with hint and error support. **Key
props:** `label`, `hint`, `error`, `required`, `type`, standard input props.
**Accessibility:** Associates the visible label and descriptions; errors set
`aria-invalid` and keep the entered value.

```tsx
import { TextField } from '@webable/ui';
<TextField label="Email" type="email" autoComplete="email" error={error} />
```

### Select

**Purpose:** Labeled native select. **Key props:** `label`, `options` (value,
label, optional disabled), `hint`, `error`, `required`. **Accessibility:**
Retains native select keyboard and screen-reader behavior and connects its
label and descriptions.

```tsx
import { Select } from '@webable/ui';
<Select label="Language" options={languages} value={language} onChange={chooseLanguage} />
```

## Disclosure and overlays

### Disclosure

**Purpose:** Expand or collapse a content panel. **Key props:** `title`,
`children`, `open`/`defaultOpen`, `onOpenChange`, `density`, `headingLevel`,
`meta`. **Accessibility:** Announces expanded state and panel relationship;
collapsed content remains discoverable by find-in-page.

```tsx
import { Disclosure } from '@webable/ui';
<Disclosure title="Details">More information goes here.</Disclosure>
```

### Tooltip

**Purpose:** Show supplementary text on hover or keyboard focus. **Key props:**
`content`, one focusable `children` element, `placement`, `delay`,
`isDisabled`. **Accessibility:** Focus opens it immediately; Escape dismisses
it. Never use it as the only label or for links.

```tsx
import { IconButton, Tooltip } from '@webable/ui';
<Tooltip content="More about this setting"><IconButton icon="info" label="About this setting" /></Tooltip>
```

### Dialog

**Purpose:** Present a modal for an irreversible or global action. **Key
props:** `open`, `onOpenChange`, `title`, `description`, `children`, `actions`.
**Accessibility:** Uses a native modal dialog, focuses the heading, traps
modal focus, closes on Escape, and restores focus to the opener.

```tsx
import { Dialog } from '@webable/ui';
<Dialog open={open} onOpenChange={setOpen} title="Delete data?">This cannot be undone.</Dialog>
```

### Sheet

**Purpose:** Present a bottom sheet or full-screen sheet. **Key props:**
`placement` (`bottom` or `full`), `open`, `onOpenChange`, `title`,
`headerStart`, `footer`. **Accessibility:** Shares Dialog's focus, Escape,
and accessible-title behavior.

```tsx
import { Sheet } from '@webable/ui';
<Sheet open={open} onOpenChange={setOpen} title="Menu" placement="full">{children}</Sheet>
```

### Toast

**Purpose:** Render one notification, optionally with an action. **Key props:**
`message`, `applied`, `action`, `tone`, `onDismiss`. **Accessibility:** The
component itself does not take focus; use `ToastProvider` for a persistent
polite live region.

```tsx
import { Toast } from '@webable/ui';
<Toast message="Text size updated." applied onDismiss={dismiss} />
```

### ToastProvider

**Purpose:** Provide the toast API and live region for a subtree. **Key
props:** `children`, `placement`, `resetKey`, `duration`. **Accessibility:**
Announces messages politely, pauses timeouts while hovered or focused, and
restores focus if it was inside a toast that leaves.

```tsx
import { ToastProvider } from '@webable/ui';
<ToastProvider placement="site">{children}</ToastProvider>
```

## Status, fit, and structure

### StatusGlyph

**Purpose:** Show a status glyph that stops animating after prolonged checking.
**Key props:** `state`, `size`. **Accessibility:** Decorative; accompany it
with a status word.

```tsx
import { StatusGlyph } from '@webable/ui';
<StatusGlyph state="checking" />
```

### StatusLine

**Purpose:** Show a prominent status and title, such as in a popup. **Key
props:** `state`, `title`, `stillCheckingTitle`, `as`, `focusable`. **Accessibility:**
The status text remains visible alongside its decorative glyph.

```tsx
import { StatusLine } from '@webable/ui';
<StatusLine state="adapted" title="Adapted · 3 changes" as="h1" />
```

### StatusPill

**Purpose:** Display a compact, non-interactive status in a list. **Key
props:** `state`, optional `label`. **Accessibility:** Includes visible status
text; the shape and color are additional cues.

```tsx
import { StatusPill } from '@webable/ui';
<StatusPill state="paused" />
```

### FitDigits

**Purpose:** Tighten punctuation within a displayed numeric value. **Key
props:** `children` (a string or number). **Accessibility:** The punctuation
remains part of the same readable value.

```tsx
import { FitDigits } from '@webable/ui';
<FitDigits>4.5:1</FitDigits>
```

### FitUnit

**Purpose:** Style the unit after a fit value. **Key props:** `unit`,
optional `className`. **Accessibility:** Use a clear unit; for spoken unit
expansion, see `FitMark`.

```tsx
import { FitDigits, FitUnit } from '@webable/ui';
<><FitDigits>18</FitDigits><FitUnit unit="px" /></>
```

### FitMark

**Purpose:** Show a before-to-after fit value, optionally with a label. **Key
props:** `from`, `to`, `unit`, `unitSpoken`, `label`, `size`. **Accessibility:**
The visible graphic is hidden from screen readers, which receive the complete
spoken value.

```tsx
import { FitMark } from '@webable/ui';
<FitMark label="Text size" from={13} to={18} unit="px" />
```

### FitMarkBlock

**Purpose:** Draw a measured dimension line with its value. **Key props:**
`label`, `from`, `to`, `unit`, `plate`, `draw`. **Accessibility:** Exposes an
image role with an accessible name containing the measurement and spoken unit.

```tsx
import { FitMarkBlock } from '@webable/ui';
<FitMarkBlock label="Text size" from={13} to={18} unit="px" />
```

### FitValue

**Purpose:** Display a fit result: change, minimum floor, word setting, or
unchanged value. **Key props:** `value` (discriminated by `kind`, each with
`srText`), `size`. **Accessibility:** Screen readers receive the supplied
complete `srText`, not the decorative visual.

```tsx
import { FitValue } from '@webable/ui';
<FitValue value={{ kind: 'change', before: 16, after: 19, unit: 'px', srText: '16 to 19 pixels' }} />
```

### FitRow

**Purpose:** Lay out one row of a "Your fit" summary. **Key props:**
`label`, `headingLevel`, `sentence`, `value`, `density`, `changed`, optional
`source`, `action`, `editor`. **Accessibility:** Uses a real heading for the
row label; choose the level to fit the surrounding outline.

```tsx
import { FitRow } from '@webable/ui';
<FitRow label="Text size" headingLevel={3} sentence="Text reads best at 19 px." value={fit} density="working" changed />
```

### IndexRule

**Purpose:** Render the decorative index rule used by section headers. **Key
props:** optional `className`. **Accessibility:** Hidden from assistive
technology.

```tsx
import { IndexRule } from '@webable/ui';
<IndexRule />
```

### SectionHeader

**Purpose:** Structure a section with an eyebrow, heading, deck, and optional
link. **Key props:** `title`, `eyebrow`, `deck`, `link`, `as`, `titleId`.
**Accessibility:** Choose the heading element to preserve the page's heading
hierarchy.

```tsx
import { SectionHeader } from '@webable/ui';
<SectionHeader as="h2" title="Your fit" deck="Settings for this site." />
```

### EmptyState

**Purpose:** Explain an empty view and offer one next action. **Key props:**
`title`, sentence as `children`, `action`, `density`, `as`. **Accessibility:**
Choose the title element to match the surrounding heading outline.

```tsx
import { Button, EmptyState } from '@webable/ui';
<EmptyState title="No sites yet." action={<Button>Add a site</Button>}>Changed sites appear here.</EmptyState>
```

### ErrorPanel

**Purpose:** Explain an error and optionally provide an action or details.
**Key props:** `title`, explanation as `children`, `action`, `details`,
`live`, `as`. **Accessibility:** Set `live` to announce a newly displayed
error immediately; details use a disclosure.

```tsx
import { Button, ErrorPanel } from '@webable/ui';
<ErrorPanel title="Could not save" live action={<Button onClick={retry}>Try again</Button>}>Your changes are safe. Please retry.</ErrorPanel>
```

### Kbd

**Purpose:** Style a keyboard key or shortcut. **Key props:** `children`,
optional `className`. **Accessibility:** Use concise text that names the key
being pressed.

```tsx
import { Kbd } from '@webable/ui';
<Kbd>Esc</Kbd>
```

### VisuallyHidden

**Purpose:** Provide text for screen readers without visual display. **Key
props:** `children`. **Accessibility:** Use only for concise information that
is necessary to understand the interface.

```tsx
import { VisuallyHidden } from '@webable/ui';
<VisuallyHidden>Opens in a new window</VisuallyHidden>
```

### ProgressRuler

**Purpose:** Show proportional progress through named sections and tasks.
**Key props:** `sections` (`id`, `label`, `tasks`), `current`,
`taskIndex`, `label`. **Accessibility:** The graphic is decorative; an
ordered list exposes each step and marks the current step.

```tsx
import { ProgressRuler } from '@webable/ui';
<ProgressRuler sections={sections} current={1} taskIndex={2} />
```

### OfferBlock

**Purpose:** Present an optional, non-modal offer with accept and decline
actions. **Key props:** `question`, `reason`, `onAccept`, `onDecline`,
optional `onNeverHere` and action labels. **Accessibility:** The section is
named by its question and described by its reason.

```tsx
import { OfferBlock } from '@webable/ui';
<OfferBlock question="Make buttons bigger here?" onAccept={accept} onDecline={decline} />
```

## Related hooks and utilities

`useToast()` returns `{ show, dismiss }` and must be used under
`ToastProvider`; `show(options)` returns a function that dismisses that toast.
`useStillChecking(state)` reports when a checking state has lasted five
seconds. `isInternalHref(href)` identifies same-origin paths, and `cx(...)`
joins conditional class names. `rulerGeometry(...)` returns the progress
ruler's fractional geometry. `spokenUnit(unit)` expands known abbreviations,
and `STATUS_LABELS` / `STOP_CHECKING_MS` expose the status copy and timing.
