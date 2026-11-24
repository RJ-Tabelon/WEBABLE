// Supabase clients for Edge Functions.
//
// Hosted functions receive SUPABASE_URL, SUPABASE_ANON_KEY and
// SUPABASE_SERVICE_ROLE_KEY automatically. Projects on the new API keys also get
// SUPABASE_PUBLISHABLE_KEYS / SUPABASE_SECRET_KEYS (JSON objects keyed by name);
// both forms are accepted. Clients never persist or refresh sessions.

import {
  createClient,
  type SupabaseClient,
} from 'npm:@supabase/supabase-js@2.117.2';

export type { SupabaseClient };

/** Read-only view of the environment, injectable in tests. */
export interface EnvReader {
  get(name: string): string | undefined;
}

export const denoEnv: EnvReader = {
  get: (name) => Deno.env.get(name),
};

/** An environment built from a plain object (tests, local scripts). */
export function envFrom(values: Record<string, string | undefined>): EnvReader {
  return { get: (name) => values[name] };
}

export class MissingEnvError extends Error {
  readonly variable: string;
  constructor(variable: string) {
    super(`Missing environment variable ${variable}.`);
    this.name = 'MissingEnvError';
    this.variable = variable;
  }
}

function requireEnv(env: EnvReader, name: string): string {
  const value = env.get(name)?.trim();
  if (!value) throw new MissingEnvError(name);
  return value;
}

/** First value of a `{ "default": "...", ... }` key map, preferring "default". */
function fromKeyMap(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const map = parsed as Record<string, unknown>;
      const preferred = map.default ?? Object.values(map)[0];
      return typeof preferred === 'string' && preferred ? preferred : undefined;
    }
  } catch {
    // Not JSON: ignore.
  }
  return undefined;
}

export function supabaseUrl(env: EnvReader): string {
  const url = requireEnv(env, 'SUPABASE_URL');
  try {
    return new URL(url).origin;
  } catch {
    throw new MissingEnvError('SUPABASE_URL');
  }
}

/** Publishable (or legacy anon) key: safe to use for user-scoped requests. */
export function publishableKey(env: EnvReader): string {
  const key =
    env.get('SUPABASE_ANON_KEY')?.trim() ||
    fromKeyMap(env.get('SUPABASE_PUBLISHABLE_KEYS'));
  if (!key) throw new MissingEnvError('SUPABASE_ANON_KEY');
  return key;
}

/** Secret (or legacy service_role) key. Server-only; bypasses RLS. */
export function secretKey(env: EnvReader): string {
  const key =
    env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim() ||
    fromKeyMap(env.get('SUPABASE_SECRET_KEYS'));
  if (!key) throw new MissingEnvError('SUPABASE_SERVICE_ROLE_KEY');
  return key;
}

const NO_SESSION = {
  persistSession: false,
  autoRefreshToken: false,
  detectSessionInUrl: false,
} as const;

/** A client for verifying tokens with the Auth server and JWKS. */
export function createAuthClient(env: EnvReader): SupabaseClient {
  return createClient(supabaseUrl(env), publishableKey(env), {
    auth: NO_SESSION,
  });
}

/**
 * A client that acts as the caller: RLS applies exactly as in the apps. Use it
 * for anything that reads or writes the caller's own rows.
 */
export function createUserClient(
  env: EnvReader,
  accessToken: string,
): SupabaseClient {
  return createClient(supabaseUrl(env), publishableKey(env), {
    auth: NO_SESSION,
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

/**
 * The service-role client. It bypasses RLS: use it only for admin APIs and
 * service-only RPCs (consume_ai_quota), and only after verifying the caller.
 */
export function createServiceClient(env: EnvReader): SupabaseClient {
  return createClient(supabaseUrl(env), secretKey(env), { auth: NO_SESSION });
}
