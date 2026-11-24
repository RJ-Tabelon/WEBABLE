// Verify the caller's Supabase access token inside an Edge Function.
//
// Primary path: supabase-js `auth.getClaims(jwt)`. With asymmetric signing keys
// it verifies locally against the project's JWKS; with legacy HS256 tokens (this
// project today) it asks the Auth server. If getClaims fails for a reason other
// than a bad token (network, JWKS fetch), fall back to `auth.getUser(jwt)`.
//
// `requireLiveSession` additionally confirms with the Auth server that the
// session behind the token has not been signed out. Use it for anything that
// mints new credentials (extension-link), so a leaked short-lived access token
// cannot be turned into a long-lived session after its owner signed out.

import {
  createAuthClient,
  type EnvReader,
  type SupabaseClient,
} from './supabase.ts';

export interface VerifiedUser {
  id: string;
  email: string | null;
  isAnonymous: boolean;
  sessionId: string | null;
}

export type AuthErrorCode =
  'missing_token' | 'invalid_token' | 'auth_unavailable';

export type AuthResult =
  | { ok: true; user: VerifiedUser; token: string }
  | { ok: false; status: 401 | 503; code: AuthErrorCode; message: string };

/** The error shape supabase-js returns; kept structural so tests can fake it. */
export interface AuthLikeError {
  name?: string;
  status?: number;
  code?: string;
  message: string;
}

export interface ClaimsResult {
  data: { claims: Record<string, unknown> } | null;
  error: AuthLikeError | null;
}

export interface UserResult {
  data: {
    user: { id: string; email?: string | null; is_anonymous?: boolean } | null;
  };
  error: AuthLikeError | null;
}

/** The two supabase-js Auth calls this module needs. */
export interface AuthVerifier {
  getClaims(jwt: string): Promise<ClaimsResult>;
  getUser(jwt: string): Promise<UserResult>;
}

export interface VerifyOptions {
  /** Confirm the session is still live with the Auth server (see file comment). */
  requireLiveSession?: boolean;
  /** Expected `iss`, normally `${SUPABASE_URL}/auth/v1`. Skipped when omitted. */
  issuer?: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const JWT_SHAPE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*$/;
const MAX_TOKEN_LENGTH = 8192;

/** Auth-server codes that mean "this token will never work", not "try later". */
const INVALID_TOKEN_CODES = new Set([
  'bad_jwt',
  'no_authorization',
  'session_not_found',
  'session_expired',
  'user_not_found',
  'user_banned',
]);

/** Extract a well-formed bearer token, or null. */
export function bearerToken(req: Request): string | null {
  const header = req.headers.get('authorization');
  if (!header) return null;
  const match = /^Bearer\s+(\S+)\s*$/i.exec(header);
  const token = match?.[1];
  if (!token || token.length > MAX_TOKEN_LENGTH || !JWT_SHAPE.test(token))
    return null;
  return token;
}

/** True when an Auth error means the token is bad (as opposed to Auth being unreachable). */
export function isInvalidTokenError(error: AuthLikeError): boolean {
  if (error.name === 'AuthInvalidJwtError') return true;
  if (error.name === 'AuthRetryableFetchError') return false;
  if (error.code && INVALID_TOKEN_CODES.has(error.code)) return true;
  const status = error.status ?? 0;
  return status >= 400 && status < 500 && status !== 408 && status !== 429;
}

const invalid = (message: string): AuthResult => ({
  ok: false,
  status: 401,
  code: 'invalid_token',
  message,
});
const unavailable = (): AuthResult => ({
  ok: false,
  status: 503,
  code: 'auth_unavailable',
  message: 'Could not verify the session right now.',
});

function audienceIncludes(aud: unknown, expected: string): boolean {
  if (typeof aud === 'string') return aud === expected;
  return Array.isArray(aud) && aud.includes(expected);
}

/** Check the claims WebAble relies on. Returns an error message or null. */
function checkClaims(
  claims: Record<string, unknown>,
  issuer?: string,
): string | null {
  if (claims.role !== 'authenticated')
    return 'Token is not for a signed-in user.';
  if (typeof claims.sub !== 'string' || !UUID.test(claims.sub))
    return 'Token has no valid subject.';
  if (!audienceIncludes(claims.aud, 'authenticated'))
    return 'Token audience is not authenticated.';
  if (issuer && claims.iss !== issuer)
    return 'Token issuer does not match this project.';
  return null;
}

async function safely<T>(call: () => Promise<T>): Promise<T | 'threw'> {
  try {
    return await call();
  } catch {
    return 'threw';
  }
}

/** Verify an access token. Never throws. */
export async function verifyAccessToken(
  token: string,
  verifier: AuthVerifier,
  opts: VerifyOptions = {},
): Promise<AuthResult> {
  let fromClaims: VerifiedUser | null = null;

  const claimsResult = await safely(() => verifier.getClaims(token));
  if (claimsResult !== 'threw' && claimsResult.data?.claims) {
    const claims = claimsResult.data.claims;
    const problem = checkClaims(claims, opts.issuer);
    if (problem) return invalid(problem);
    fromClaims = {
      id: claims.sub as string,
      email:
        typeof claims.email === 'string' && claims.email ? claims.email : null,
      isAnonymous: claims.is_anonymous === true,
      sessionId:
        typeof claims.session_id === 'string' ? claims.session_id : null,
    };
    if (!opts.requireLiveSession && fromClaims.email !== null) {
      return { ok: true, user: fromClaims, token };
    }
  } else if (
    claimsResult !== 'threw' &&
    claimsResult.error &&
    isInvalidTokenError(claimsResult.error)
  ) {
    return invalid('Token is invalid or expired.');
  }

  // Fallback (getClaims unavailable), live-session confirmation, or email lookup.
  const userResult = await safely(() => verifier.getUser(token));
  if (userResult === 'threw') return unavailable();
  if (userResult.error) {
    return isInvalidTokenError(userResult.error)
      ? invalid('Session is not valid.')
      : unavailable();
  }
  const user = userResult.data.user;
  if (!user || !UUID.test(user.id)) return invalid('Session is not valid.');
  if (fromClaims && fromClaims.id !== user.id)
    return invalid('Token subject does not match its session.');

  return {
    ok: true,
    token,
    user: {
      id: user.id,
      email: user.email || fromClaims?.email || null,
      isAnonymous:
        user.is_anonymous === true || fromClaims?.isAnonymous === true,
      sessionId: fromClaims?.sessionId ?? null,
    },
  };
}

/** Adapt a supabase-js client to the verifier interface. */
export function verifierFromClient(client: SupabaseClient): AuthVerifier {
  return {
    getClaims: async (jwt) => {
      const { data, error } = await client.auth.getClaims(jwt);
      return {
        data: data ? { claims: data.claims as Record<string, unknown> } : null,
        error,
      };
    },
    getUser: async (jwt) => {
      const { data, error } = await client.auth.getUser(jwt);
      return { data: { user: data.user }, error };
    },
  };
}

/**
 * Verify the request's bearer token. Builds an anon-key client from the env
 * unless a verifier is supplied (tests). The token's signature is checked by this
 * project's JWKS or Auth server, which already binds it to the project; set
 * JWT_ISSUER to also pin `iss` (it differs between hosted and `functions serve`).
 *
 * Throws MissingEnvError when SUPABASE_URL or the publishable key is not set.
 */
export async function verifyRequest(
  req: Request,
  deps: { env: EnvReader; verifier?: AuthVerifier },
  opts: VerifyOptions = {},
): Promise<AuthResult> {
  const token = bearerToken(req);
  if (!token) {
    return {
      ok: false,
      status: 401,
      code: 'missing_token',
      message: 'Send the access token as a Bearer token.',
    };
  }
  const verifier =
    deps.verifier ?? verifierFromClient(createAuthClient(deps.env));
  const issuer =
    opts.issuer ?? (deps.env.get('JWT_ISSUER')?.trim() || undefined);
  return verifyAccessToken(token, verifier, { ...opts, issuer });
}
