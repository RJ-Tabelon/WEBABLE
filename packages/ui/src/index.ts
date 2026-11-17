/**
 * @webable/ui — the WebAble component library ("Made to Measure", design-final.md).
 *
 * Import the styles once per surface, after the tokens:
 *   import '@webable/tokens/fonts.css';   // not in the in-page layer
 *   import '@webable/tokens/tokens.css';
 *   import '@webable/tokens/base.css';
 *   import '@webable/ui/styles.css';
 *
 * Interactive components carry 'use client' and work in Next.js server trees and
 * in the extension popup (Vite). Router links: wrap the app in `LinkProvider`.
 * Every component's props are documented on its exported `*Props` type.
 */

// Foundations
export {
  Icon,
  ICON_NAMES,
  type IconName,
  type IconProps,
  type IconSize,
} from './icons';
export {
  CheckGlyph,
  FitArrow,
  Mark,
  StatusShape,
  type CheckGlyphProps,
  type FitArrowProps,
  type MarkProps,
  type StatusShapeProps,
  type StatusState,
} from './glyphs';
export { Wordmark, type WordmarkProps } from './Brand';
export { isInternalHref } from './internal/href';
export {
  LinkProvider,
  Anchor,
  type LinkComponent,
  type LinkComponentProps,
  type LinkProviderProps,
} from './internal/link';
export {
  OverlayContainer,
  type OverlayContainerProps,
} from './internal/overlay';
export { cx } from './internal/cx';

// Actions
export {
  Actions,
  Button,
  type ActionsProps,
  type ButtonAsButtonProps,
  type ButtonAsLinkProps,
  type ButtonProps,
  type ButtonSize,
  type ButtonVariant,
} from './Button';
export { IconButton, type IconButtonProps } from './IconButton';
export { TextLink, type TextLinkProps } from './TextLink';

// Inputs
export { SwitchRow, type SwitchRowProps } from './SwitchRow';
export { Checkbox, type CheckboxProps } from './Checkbox';
export {
  SegmentedControl,
  type SegmentedControlProps,
  type SegmentedOption,
} from './SegmentedControl';
export { Slider, type SliderProps } from './Slider';
export {
  Hint,
  Select,
  TextField,
  type HintProps,
  type SelectOption,
  type SelectProps,
  type TextFieldProps,
} from './Field';

// Disclosure and overlays
export { Disclosure, type DisclosureProps } from './Disclosure';
export { Tooltip, type TooltipPlacement, type TooltipProps } from './Tooltip';
export { Dialog, Sheet, type DialogProps, type SheetProps } from './Dialog';
export {
  Toast,
  ToastProvider,
  useToast,
  type ToastAction,
  type ToastOptions,
  type ToastPlacement,
  type ToastProps,
  type ToastProviderProps,
} from './Toast';

// Status, fit and structure
export {
  STATUS_LABELS,
  STOP_CHECKING_MS,
  type ExtensionStatus,
} from './statusLabels';
export {
  StatusGlyph,
  StatusLine,
  StatusPill,
  useStillChecking,
  type StatusGlyphProps,
  type StatusLineProps,
  type StatusPillProps,
} from './Status';
export {
  FitDigits,
  FitMark,
  FitMarkBlock,
  FitUnit,
  spokenUnit,
  type FitMarkBlockProps,
  type FitMarkProps,
  type FitMarkValue,
} from './FitMark';
// `FitValue` is both the value type (from @webable/core's fit rows) and its view.
export {
  FitValue,
  type FitAmount,
  type FitValueProps,
  type FitValueSize,
} from './FitValue';
export { FitRow, type FitRowProps } from './FitRow';
export {
  IndexRule,
  SectionHeader,
  type SectionHeaderProps,
} from './SectionHeader';
export {
  EmptyState,
  ErrorPanel,
  Kbd,
  VisuallyHidden,
  type EmptyStateProps,
  type ErrorPanelProps,
  type KbdProps,
  type VisuallyHiddenProps,
} from './States';
export {
  ProgressRuler,
  rulerGeometry,
  type ProgressRulerProps,
  type RulerSection,
} from './ProgressRuler';
export { OfferBlock, type OfferBlockProps } from './OfferBlock';
