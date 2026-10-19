/**
 * Zod-free page vocabulary constants. The content script imports these
 * directly so it does not bundle zod into every page.
 */

export const PAGE_CATEGORIES = [
  'article',
  'feed_social',
  'search_results',
  'form_checkout',
  'web_app',
  'docs_reference',
  'media_video',
  'other',
] as const;
export type PageCategory = (typeof PAGE_CATEGORIES)[number];

export const REGION_ROLES = [
  'main_content',
  'navigation',
  'promo_ad',
  'recommendations',
  'chat_widget',
  'consent_banner',
  'help_contact',
  'form',
  'footer',
  'other',
] as const;
export type RegionRole = (typeof REGION_ROLES)[number];

/** Roles WebAble may soften. Everything else is protected. */
export const DIMMABLE_ROLES: readonly RegionRole[] = [
  'promo_ad',
  'recommendations',
  'chat_widget',
];
/**
 * Roles WebAble never dims or hides (help must stay findable: WCAG 3.2.6).
 * The one exception: a navigation bar may be unpinned so it scrolls away (unpin_bars).
 */
export const PROTECTED_ROLES: readonly RegionRole[] = [
  'main_content',
  'navigation',
  'form',
  'help_contact',
  'consent_banner',
  'footer',
];

export const PAGE_SIGNALS = [
  'jsonld_article',
  'jsonld_product',
  'jsonld_video',
  'og_type_article',
  'og_type_video',
  'readerable',
  'role_feed',
  'infinite_scroll',
  'has_site_search',
  'search_results_pattern',
  'has_password_field',
  'has_payment_fields',
  'multi_step_form',
  'has_comments_section',
  'large_video_in_main',
  'map_container',
  'rich_text_editor',
  'data_grid',
  'code_blocks',
  'many_tables',
] as const;
export type PageSignal = (typeof PAGE_SIGNALS)[number];

export const COUNT_BUCKETS = [
  '0',
  '1',
  '2-3',
  '4-10',
  '11-30',
  '31-100',
  '>100',
] as const;
export type CountBucket = (typeof COUNT_BUCKETS)[number];

export function countToBucket(count: number): CountBucket {
  if (count <= 0) return '0';
  if (count === 1) return '1';
  if (count <= 3) return '2-3';
  if (count <= 10) return '4-10';
  if (count <= 30) return '11-30';
  if (count <= 100) return '31-100';
  return '>100';
}
