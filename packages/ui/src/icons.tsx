import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Info,
  Lock,
  Menu,
  Minus,
  Monitor,
  Moon,
  Pause,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Settings,
  SlidersHorizontal,
  SquareDashed,
  Sun,
  Trash2,
  TriangleAlert,
  X,
  type LucideIcon,
} from 'lucide-react';
import type { SVGProps } from 'react';
import { cx } from './internal/cx';
import { remSize } from './internal/size';

/**
 * The only Lucide icons allowed in the product (design-final §11.2).
 * Adding one needs a design review. Never add people, eyes, ears, brains, hands,
 * hearts, sparkles, wands, robots or check-badges (§11.4).
 */
const ICONS = {
  'arrow-right': ArrowRight,
  'arrow-up-right': ArrowUpRight,
  'chevron-down': ChevronDown,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  check: Check,
  x: X,
  minus: Minus,
  plus: Plus,
  'rotate-ccw': RotateCcw,
  'rotate-cw': RotateCw,
  pause: Pause,
  play: Play,
  settings: Settings,
  menu: Menu,
  lock: Lock,
  info: Info,
  'triangle-alert': TriangleAlert,
  'circle-help': CircleHelp,
  'refresh-cw': RefreshCw,
  sun: Sun,
  moon: Moon,
  monitor: Monitor,
  'sliders-horizontal': SlidersHorizontal,
  'square-dashed': SquareDashed,
  'trash-2': Trash2,
} as const satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

/** Icon sizes in px. 16 sits inline with 15-16 px text, 20 is the default, 24 stands alone. */
export type IconSize = 16 | 20 | 24;

export const ICON_NAMES = Object.keys(ICONS) as IconName[];

export interface IconProps extends Omit<
  SVGProps<SVGSVGElement>,
  'ref' | 'name' | 'strokeWidth'
> {
  name: IconName;
  /** Rendered size in px. Default 20. */
  size?: IconSize;
  /**
   * Accessible label. Omit for decorative icons (the default): icons never appear
   * without a visible label except Close, Back, Settings and per-row controls, and
   * those carry the label on their button.
   */
  label?: string;
}

/**
 * An allowlisted Lucide icon with the house stroke: 1.75 px rendered at 16 and 20,
 * 2 px at 24, round caps, `currentColor`.
 */
export function Icon({
  name,
  size = 20,
  label,
  className,
  style,
  ...rest
}: IconProps) {
  const Glyph = ICONS[name];
  return (
    <Glyph
      size={size}
      strokeWidth={size >= 24 ? 2 : 1.75}
      absoluteStrokeWidth
      focusable="false"
      className={cx('wa-icon', className)}
      style={remSize(size, style)}
      {...(label
        ? { role: 'img', 'aria-label': label }
        : { 'aria-hidden': true })}
      {...rest}
    />
  );
}
