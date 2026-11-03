// CORS for WebAble Edge Functions.
//
// Browsers only receive Access-Control-Allow-Origin for origins on an explicit
// allowlist: the web app (WEB_ORIGINS) and the extension (EXTENSION_ORIGINS,
// chrome-extension://<id>). Auth is a bearer token, not a cookie, so CORS is
// defense in depth rather than the only CSRF control.

import { empty } from './http.ts';

/** Structural view of the environment (matches EnvReader in supabase.ts). */
interface EnvReader {
  get(name: string): string | undefined;
}

export type OriginKind = 'web' | 'extension';

export interface CorsPolicy {
  readonly allowed: ReadonlySet<string>;
  readonly allowMethods: string;
  readonly allowHeaders: string;
  /** Seconds a browser may cache a successful preflight. */
  readonly maxAge: number;
}

const DEFAULT_ALLOW_HEADERS =
  'authorization, apikey, content-type, x-client-info';
const EXTENSION_ID = /^[a-p]{32}$/;

/** Normalize one web origin entry to `scheme://host[:port]`, or null when invalid. */
export function normalizeWebOrigin(entry: string): string | null {
  const trimmed = entry.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    if (url.username || url.password) return null;
    return url.origin;
  } catch {
    return null;
  }
}

/** Accept `chrome-extension://<id>`, with or without a trailing slash, or a bare id. */
export function normalizeExtensionOrigin(entry: string): string | null {
  const trimmed = entry.trim().replace(/\/+$/, '');
  if (!trimmed) return null;
  const id = trimmed.startsWith('chrome-extension://')
    ? trimmed.slice('chrome-extension://'.length)
    : trimmed;
  return EXTENSION_ID.test(id) ? `chrome-extension://${id}` : null;
}

/** Parse a comma- or whitespace-separated list, dropping invalid entries. */
export function parseOriginList(
  value: string | undefined,
  kind: OriginKind,
): string[] {
  if (!value) return [];
  const normalize =
    kind === 'web' ? normalizeWebOrigin : normalizeExtensionOrigin;
  const out = new Set<string>();
  for (const entry of value.split(/[\s,]+/)) {
    const origin = normalize(entry);
    if (origin) out.add(origin);
  }
  return [...out];
}

/** Build a policy from WEB_ORIGINS and/or EXTENSION_ORIGINS. */
export function corsPolicyFromEnv(
  env: EnvReader,
  kinds: readonly OriginKind[],
  opts: { methods?: readonly string[]; headers?: string; maxAge?: number } = {},
): CorsPolicy {
  const allowed = new Set<string>();
  if (kinds.includes('web'))
    parseOriginList(env.get('WEB_ORIGINS'), 'web').forEach((o) =>
      allowed.add(o),
    );
  if (kinds.includes('extension')) {
    parseOriginList(env.get('EXTENSION_ORIGINS'), 'extension').forEach((o) =>
      allowed.add(o),
    );
  }
  return {
    allowed,
    allowMethods: [...(opts.methods ?? ['POST']), 'OPTIONS'].join(', '),
    allowHeaders: opts.headers ?? DEFAULT_ALLOW_HEADERS,
    maxAge: opts.maxAge ?? 600,
  };
}

export function isAllowedOrigin(
  policy: CorsPolicy,
  origin: string | null,
): boolean {
  return origin !== null && policy.allowed.has(origin);
}

/** Response headers for a request from `origin`. `Vary: Origin` is always set. */
export function corsHeaders(
  policy: CorsPolicy,
  origin: string | null,
): Record<string, string> {
  const headers: Record<string, string> = { Vary: 'Origin' };
  if (isAllowedOrigin(policy, origin)) {
    headers['Access-Control-Allow-Origin'] = origin as string;
    headers['Access-Control-Allow-Methods'] = policy.allowMethods;
    headers['Access-Control-Allow-Headers'] = policy.allowHeaders;
  }
  return headers;
}

/**
 * Answer a CORS preflight. Returns null for non-OPTIONS requests so callers can
 * write `const pre = preflight(req, policy); if (pre) return pre;`.
 */
export function preflight(req: Request, policy: CorsPolicy): Response | null {
  if (req.method !== 'OPTIONS') return null;
  const origin = req.headers.get('origin');
  if (!isAllowedOrigin(policy, origin)) return empty(403, { Vary: 'Origin' });
  return empty(204, {
    ...corsHeaders(policy, origin),
    'Access-Control-Max-Age': String(policy.maxAge),
  });
}

/**
 * Browsers always send Origin on cross-origin POSTs. Requests without one come
 * from servers (for example the web app's server calling functions.invoke) and
 * are authorized by their bearer token alone. A present but unlisted Origin is refused.
 */
export function originRefused(policy: CorsPolicy, req: Request): boolean {
  const origin = req.headers.get('origin');
  return origin !== null && !isAllowedOrigin(policy, origin);
}
