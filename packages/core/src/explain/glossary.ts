import type { OpId } from '../ops/catalog';

/**
 * The words WebAble uses for its own things, in one place, so the catalog,
 * "Your fit", "Why this changed", the popup and the app all say the same
 * thing. Labels describe pages and functions, never
 * people or conditions.
 */

/** Short noun phrase for each op, used everywhere a change is listed. */
export const OP_LABELS: Readonly<Record<OpId, string>> = {
  text_floor: 'Text size',
  page_zoom: 'Page zoom',
  line_spacing: 'Line spacing',
  line_length: 'Line length',
  contrast: 'Contrast',
  focus_outline: 'Focus outline',
  target_size: 'Click targets',
  target_spacing: 'Space between controls',
  steady_clicks: 'Steady clicks',
  menu_grace: 'Menus stay open',
  calm_motion: 'Moving things',
  pause_media: 'Autoplay',
  dim_distractions: 'Busy areas',
  focus_view: 'Focus view',
  unpin_bars: 'Sticky bars',
  reading_guide: 'Reading guide',
};

/** Where the fit lives when there is no account: "Your fit is saved in this browser." */
export const PLACE = 'this browser';

/** The fit WebAble starts from before Tune: "WebAble is using a basic fit." */
export const BASIC_FIT = 'basic fit';

/** WebAble's own re-presentation of a page: "Open Fit view". */
export const FIT_VIEW = 'Fit view';
