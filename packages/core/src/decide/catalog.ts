import type {
  JevChoiceQuestion,
  JevEntry,
  JevNoulQuestion,
  JevQuestion,
  JevResponse,
  JevState,
  JsonValue,
} from '../jev/api';
import {
  PAGE_CATEGORIES,
  PAGE_SIGNALS,
  REGION_ROLES,
  type PageCategory,
  type PageContext,
  type RegionEvidence,
  type RegionRole,
} from '../page/types';
import { CATALOG_VERSION, JEV_PINNED_MODEL } from '../versions';
import type { DecideRequest, DecideResponse } from './wire';

/**
 * Question catalog wa-cat-1.0.0. This module is the
 * only place question text exists; clients send evidence, never questions.
 *
 * Rules the catalog follows (all from the Jev field evidence):
 * - every Choice has an escape option (`other` / `none`);
 * - options carry contrastive `{ what, not_for }` criteria;
 * - option order is fixed and matches the enums in page/types.ts;
 * - a Noul is phrased so that yes means the risky fact (the block is needed);
 * - page context goes in `state`, each region's evidence inside its own question;
 * - keys are emitted in the declared order (canonical serialization), never sorted.
 */

export interface Criterion {
  what: string;
  not_for: string | null;
}

export const PAGE_TYPE_QUESTION_ID = 'page_type';
export const MAIN_PICK_QUESTION_ID = 'main_pick';
export const roleQuestionId = (rid: string): string => `role_${rid}`;
export const taskQuestionId = (rid: string): string => `task_${rid}`;

export const PAGE_TYPE_INSTRUCTIONS =
  'What kind of page is described in `page`? Judge only from its structural signals and counts.';
export const ROLE_QUESTION =
  'What job does the block described in `region` do on the page described in `page`?';
export const TASK_QUESTION =
  'Would a visitor doing the main thing this page is for need to read or use the block described in `region`?';
export const MAIN_PICK_INSTRUCTIONS =
  'Which candidate block is the main content of the page described in `page`, the part the page exists for?';
export const MAIN_PICK_NONE = 'None of these blocks is the main content.';

/** Q1 `page_type` options, in PAGE_CATEGORIES order. */
export const PAGE_TYPE_CRITERIA: Readonly<Record<PageCategory, Criterion>> = {
  article: {
    what: 'A page mainly for reading one piece of prose: a news story, blog post, essay or long help article.',
    not_for: 'Lists of many stories; reference docs full of code or tables.',
  },
  feed_social: {
    what: 'A stream of posts or cards from many authors or sources, endless or paginated.',
    not_for: 'A single article; results for a search query.',
  },
  search_results: {
    what: 'Results returned for a query, usually with a search box and filters.',
    not_for: 'A category page or feed with no query.',
  },
  form_checkout: {
    what: 'A page whose main purpose is filling in and submitting a form: checkout, sign-up, sign-in, application, booking.',
    not_for: 'A page that only has a small newsletter or search form.',
  },
  web_app: {
    what: 'An interactive application: email, editor, dashboard, map, calendar or chat app.',
    not_for: 'A document that happens to have some buttons.',
  },
  docs_reference: {
    what: 'Technical or reference documentation: API docs, manuals, wikis with many sections, tables or code.',
    not_for: 'A news article or blog post.',
  },
  media_video: {
    what: 'A page built around playing one video or audio item.',
    not_for: 'An article with an embedded video.',
  },
  other: {
    what: 'Anything else, including home pages and product pages, or too little evidence to tell.',
    not_for: null,
  },
};

/** Q2 `role_<rid>` options, in REGION_ROLES order. */
export const ROLE_CRITERIA: Readonly<Record<RegionRole, Criterion>> = {
  main_content: {
    what: 'The primary content the page exists for: the article body, the result list, the product details, the working area of an app, or the main form.',
    not_for: 'Side panels, teasers for other pages, site-wide menus.',
  },
  navigation: {
    what: 'Site or section menus, a header with menu links, breadcrumbs, pagination, a table of contents, or filters and sorting for a list.',
    not_for: 'Rails of teaser cards for other articles or products.',
  },
  promo_ad: {
    what: 'Advertising, sponsored or promoted items, marketing or sale banners, newsletter or app-install prompts.',
    not_for:
      'Links to related articles with no sales purpose; cookie or privacy notices.',
  },
  recommendations: {
    what: 'Teasers pointing to other content: related, recommended, trending, popular, more-from or you-may-also-like rails.',
    not_for: 'The main list on a feed or search page; paid advertising.',
  },
  chat_widget: {
    what: 'A floating chat launcher or chat window run by a support or sales chat service.',
    not_for: 'A help or contact section that is part of the page layout.',
  },
  consent_banner: {
    what: 'A cookie, privacy or consent notice asking the visitor to accept, reject or manage settings.',
    not_for: 'A sign-in prompt or a newsletter popup.',
  },
  help_contact: {
    what: 'Ways to get help: help or support links, contact details or a contact form, FAQ, accessibility or feedback links.',
    not_for: 'A floating chat launcher; the site footer as a whole.',
  },
  form: {
    what: "Fields the visitor fills in and submits to do the page's task: checkout, sign-in, booking, application, advanced search.",
    not_for: 'A single newsletter box; the site search box in the header.',
  },
  footer: {
    what: 'The site footer: the bottom block of site links, legal notices, copyright and social links.',
    not_for: 'A help or contact block that stands on its own.',
  },
  other: {
    what: 'A clear job not listed here, such as comments, a media player, an author bio or a logo-only header, or too little evidence to tell.',
    not_for: null,
  },
};

/** Q3 `task_<rid>` criteria: yes means the block is needed (the risky fact). */
export const TASK_CRITERIA = {
  true: "The block holds content or controls needed for the page's main task, such as filters, the cart, player controls, form fields, pagination or help.",
  false:
    'The block can be ignored without affecting the main task, such as ads, teasers for other pages or decorative banners.',
} as const;

/** Whole-request cap; lowest-priority regions are trimmed above it. */
export const MAX_REQUEST_TOKENS = 12_000;
/** Conservative characters-per-token ratio for this JSON (replace with pilot `usage.input_tokens`). */
export const CHARS_PER_TOKEN = 3.3;
export const MAX_REGIONS_PER_CALL = 10;

/** Conservative token estimate for any JSON value: characters / 3.3, rounded up. */
export function estimateTokens(value: unknown): number {
  return Math.ceil(JSON.stringify(value).length / CHARS_PER_TOKEN);
}

type JsonObject = { [key: string]: JsonValue };

/** Page context with keys in declared order and signals in enum order, deduplicated. */
export function canonicalPageContext(page: PageContext): JsonObject {
  const present = new Set(page.signals);
  return {
    signals: PAGE_SIGNALS.filter((s) => present.has(s)),
    main: {
      found_by: page.main.found_by,
      zone: page.main.zone,
      width: page.main.width,
    },
    counts: {
      regions: page.counts.regions,
      links: page.counts.links,
      buttons: page.counts.buttons,
      text_inputs: page.counts.text_inputs,
      forms: page.counts.forms,
      required_fields: page.counts.required_fields,
      headings: page.counts.headings,
      images: page.counts.images,
      videos: page.counts.videos,
      text_amount: page.counts.text_amount,
    },
    layout: {
      viewport: page.layout.viewport,
      page_height: page.layout.page_height,
      pinned_bars: page.layout.pinned_bars,
    },
  };
}

/** Region evidence with keys in the order RegionEvidence declares them (decisive fields first). */
export function canonicalEvidence(ev: RegionEvidence): JsonObject {
  return {
    zone: ev.zone,
    width: ev.width,
    height: ev.height,
    pinned: ev.pinned,
    landmark: ev.landmark,
    tag: ev.tag,
    dom_position: ev.dom_position,
    links: ev.links,
    link_density: ev.link_density,
    text_amount: ev.text_amount,
    buttons: ev.buttons,
    inputs: ev.inputs,
    required_fields: ev.required_fields,
    repeated_cards: ev.repeated_cards,
    images: ev.images,
    video: ev.video,
    iframe_kind: ev.iframe_kind,
    motion: ev.motion,
    class_words: [...ev.class_words],
    heading_words: ev.heading_words,
    control_words: [...ev.control_words],
  };
}

function criteriaObject<K extends string>(
  order: readonly K[],
  table: Readonly<Record<K, Criterion>>,
): JsonObject {
  const out: JsonObject = {};
  for (const key of order) {
    const c = table[key];
    out[key] = { what: c.what, not_for: c.not_for };
  }
  return out;
}

export function pageTypeQuestion(): JevChoiceQuestion<PageCategory> {
  return {
    type: 'choice',
    instructions: PAGE_TYPE_INSTRUCTIONS,
    criteria: criteriaObject(PAGE_CATEGORIES, PAGE_TYPE_CRITERIA) as Record<
      PageCategory,
      JsonObject
    >,
  };
}

export function roleQuestion(
  ev: RegionEvidence,
): JevChoiceQuestion<RegionRole> {
  return {
    type: 'choice',
    instructions: { question: ROLE_QUESTION, region: canonicalEvidence(ev) },
    criteria: criteriaObject(REGION_ROLES, ROLE_CRITERIA) as Record<
      RegionRole,
      JsonObject
    >,
  };
}

export function taskQuestion(ev: RegionEvidence): JevNoulQuestion {
  return {
    type: 'noul',
    instructions: { question: TASK_QUESTION, region: canonicalEvidence(ev) },
    criteria: { true: TASK_CRITERIA.true, false: TASK_CRITERIA.false },
  };
}

export type MainPickOption = 'c1' | 'c2' | 'c3' | 'c4' | 'none';

export function mainPickQuestion(
  candidates: ReadonlyArray<{
    cid: Exclude<MainPickOption, 'none'>;
    ev: RegionEvidence;
  }>,
): JevChoiceQuestion<MainPickOption> {
  const criteria: Partial<Record<MainPickOption, JevEntry>> = {};
  // Candidates stay in DOM order (as sent) with neutral names.
  for (const c of candidates) criteria[c.cid] = canonicalEvidence(c.ev);
  criteria.none = MAIN_PICK_NONE;
  return {
    type: 'choice',
    instructions: MAIN_PICK_INSTRUCTIONS,
    // Only the candidates sent (2-4) plus `none` are options; absent cids are not keys.
    criteria: criteria as Record<MainPickOption, JevEntry>,
  };
}

const WIDTH_SHARE: Record<RegionEvidence['width'], number> = {
  '<15%': 0.075,
  '15-30%': 0.225,
  '30-60%': 0.45,
  '60-90%': 0.75,
  '>90%': 0.95,
};
const HEIGHT_SCREENS: Record<RegionEvidence['height'], number> = {
  '<0.1 screens': 0.05,
  '0.1-0.3 screens': 0.2,
  '0.3-1 screens': 0.65,
  '1-3 screens': 2,
  '>3 screens': 4,
};

/**
 * Region priority `areaPct x opRelevance`, estimated
 * from buckets because the server never sees geometry: viewport share is
 * width x min(height, 1 screen); relevance is 2 for fixed/sticky, 1.5 for side
 * rails and the header band, 1 otherwise.
 */
export function regionPriority(ev: RegionEvidence): number {
  const area = WIDTH_SHARE[ev.width] * Math.min(HEIGHT_SCREENS[ev.height], 1);
  const relevance =
    ev.pinned !== 'no'
      ? 2
      : ev.zone === 'left_rail' ||
          ev.zone === 'right_rail' ||
          ev.zone === 'header_band'
        ? 1.5
        : 1;
  return area * relevance;
}

export interface BuiltQuestions {
  state: JevState;
  questions: Record<string, JevQuestion>;
  estimatedTokens: number;
  /** Region ids dropped to stay under MAX_REQUEST_TOKENS (lowest priority first). */
  trimmed: string[];
}

function assemble(
  req: DecideRequest,
  regions: ReadonlyArray<DecideRequest['regions'][number]>,
): Record<string, JevQuestion> {
  const questions: Record<string, JevQuestion> = {};
  if (req.ask.pageType) questions[PAGE_TYPE_QUESTION_ID] = pageTypeQuestion();
  for (const region of regions) {
    questions[roleQuestionId(region.rid)] = roleQuestion(region.ev);
    questions[taskQuestionId(region.rid)] = taskQuestion(region.ev);
  }
  if (req.mainCandidates && req.mainCandidates.length >= 2) {
    questions[MAIN_PICK_QUESTION_ID] = mainPickQuestion(req.mainCandidates);
  }
  return questions;
}

/**
 * Server-only question builder for catalog wa-cat-1.0.0.
 * The ONLY place question text exists. Clients send evidence, never questions.
 * Page context goes in `state`; each region's evidence goes inside its own
 * question's `instructions` object. Every Choice has an escape option.
 * Trims lowest-priority regions if the estimated token count exceeds 12k.
 */
export function buildQuestions(req: DecideRequest): BuiltQuestions {
  const state: JevState = { page: canonicalPageContext(req.page) };

  // At most 10 regions, first occurrence of each rid wins (the schema already caps the array).
  const seen = new Set<string>();
  const regions = req.regions
    .filter((r) => {
      if (seen.has(r.rid)) return false;
      seen.add(r.rid);
      return true;
    })
    .slice(0, MAX_REGIONS_PER_CALL);

  const trimmed: string[] = [];
  let kept = [...regions];
  let questions = assemble(req, kept);
  let estimatedTokens = estimateTokens({
    model: JEV_PINNED_MODEL,
    state,
    questions,
  });

  while (estimatedTokens > MAX_REQUEST_TOKENS && kept.length > 0) {
    // Drop the lowest-priority region; on ties, the later one in DOM order goes first.
    let worst = 0;
    for (let i = 1; i < kept.length; i += 1) {
      if (regionPriority(kept[i]!.ev) <= regionPriority(kept[worst]!.ev))
        worst = i;
    }
    trimmed.push(kept[worst]!.rid);
    kept = kept.filter((_, i) => i !== worst);
    questions = assemble(req, kept);
    estimatedTokens = estimateTokens({
      model: JEV_PINNED_MODEL,
      state,
      questions,
    });
  }

  return { state, questions, estimatedTokens, trimmed };
}

const MAIN_PICK_OPTIONS: readonly MainPickOption[] = [
  'c1',
  'c2',
  'c3',
  'c4',
  'none',
];

function choiceProbabilities<K extends string>(
  answer: JevResponse['answers'][string] | undefined,
  keys: readonly K[],
): Record<K, number> | null {
  if (!answer || answer.type !== 'choice') return null;
  const out = {} as Record<K, number>;
  for (const key of keys) {
    const p = answer.probabilities[key];
    out[key] =
      typeof p === 'number' && Number.isFinite(p)
        ? Math.min(1, Math.max(0, p))
        : 0;
  }
  return out;
}

/**
 * Compact a (shape-checked) Jev response into the wire answer the extension
 * receives: probabilities only. `confidence`, the `choice` echo and `legend`
 * are dropped; options Jev omitted are filled with 0 so records are complete.
 * Regions whose role or task answer is missing are left out (no L2 action).
 */
export function toDecideResponse(
  built: Pick<BuiltQuestions, 'questions'>,
  jev: JevResponse,
  ms: { jev: number; edge: number },
): Extract<DecideResponse, { ok: true }> {
  const regions: Extract<DecideResponse, { ok: true }>['regions'] = {};
  for (const id of Object.keys(built.questions)) {
    if (!id.startsWith('role_')) continue;
    const rid = id.slice('role_'.length);
    const role = choiceProbabilities(jev.answers[id], REGION_ROLES);
    const task = jev.answers[taskQuestionId(rid)];
    if (!role || !task || task.type !== 'noul' || !Number.isFinite(task.noul))
      continue;
    regions[rid] = { role, task: Math.min(1, Math.max(0, task.noul)) };
  }

  const pageType =
    PAGE_TYPE_QUESTION_ID in built.questions
      ? choiceProbabilities(jev.answers[PAGE_TYPE_QUESTION_ID], PAGE_CATEGORIES)
      : null;
  const mainPick =
    MAIN_PICK_QUESTION_ID in built.questions
      ? choiceProbabilities(
          jev.answers[MAIN_PICK_QUESTION_ID],
          MAIN_PICK_OPTIONS,
        )
      : null;

  // Keys in schema order.
  return {
    v: 1,
    ok: true,
    catalog: CATALOG_VERSION,
    model: jev.model,
    ...(pageType ? { pageType } : {}),
    ...(mainPick ? { mainPick } : {}),
    regions,
    inputTokens: Math.max(0, Math.round(jev.usage.input_tokens)),
    ms: { jev: Math.max(0, ms.jev), edge: Math.max(0, ms.edge) },
  };
}
