// extension-link: mint a single-use sign-in token for the caller's extension.
//
// The signed-in web app calls this with the person's access token. We verify the
// token (and that its session is still live), then ask Auth for a magic-link
// token hash for the same email *without sending any email*. The web app hands
// the hash to the extension over externally_connectable; the extension's service
// worker calls verifyOtp({ type: 'magiclink', token_hash }) and gets its own
// session. The web app's refresh token never leaves the web app.
//
// Request:  POST, Authorization: Bearer <access token>, body empty or {}.
// Response: 200 { tokenHash, email }  |  { error: { code, message } }.

import { type AuthResult } from '../_shared/auth.ts';
import {
  type CorsPolicy,
  corsHeaders,
  originRefused,
  preflight,
} from '../_shared/cors.ts';
import {
  empty,
  errorResponse,
  fromHttpError,
  HttpError,
  json,
  logEvent,
  readJsonBody,
} from '../_shared/http.ts';
import type { RateLimiter } from './rate-limit.ts';

export const MAX_BODY_BYTES = 1024;

export interface MagicLinkResult {
  hashedToken: string;
  userId: string;
  verificationType: string;
}

export interface ExtensionLinkDeps {
  /** Allowed browser origins (web app only). */
  cors: CorsPolicy;
  /** Verify the caller; must confirm the session is live. */
  verify(req: Request): Promise<AuthResult>;
  /** admin.generateLink({ type: 'magiclink', email }) with the service-role client. */
  generateMagicLink(email: string): Promise<MagicLinkResult>;
  /** Per-person limit. */
  perUser: RateLimiter;
  /** Per-isolate ceiling on admin API calls. */
  global: RateLimiter;
  now(): number;
  log?: typeof logEvent;
}

export interface ExtensionLinkResponse {
  tokenHash: string;
  email: string;
}

function isEmptyObject(value: unknown): boolean {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).length === 0
  );
}

export function createHandler(
  deps: ExtensionLinkDeps,
): (req: Request) => Promise<Response> {
  const log = deps.log ?? logEvent;

  return async function handle(req: Request): Promise<Response> {
    const pre = preflight(req, deps.cors);
    if (pre) return pre;

    const cors = corsHeaders(deps.cors, req.headers.get('origin'));

    if (originRefused(deps.cors, req)) {
      return errorResponse(
        403,
        'forbidden_origin',
        'This origin may not request a link.',
        cors,
      );
    }
    if (req.method !== 'POST') {
      return empty(405, { ...cors, Allow: 'POST, OPTIONS' });
    }

    try {
      const body = await readJsonBody(req, { maxBytes: MAX_BODY_BYTES });
      if (body !== undefined && !isEmptyObject(body)) {
        throw new HttpError(
          400,
          'bad_request',
          'The body must be empty or {}.',
        );
      }

      const auth = await deps.verify(req);
      if (!auth.ok) {
        return errorResponse(
          auth.status,
          auth.status === 401 ? 'unauthorized' : 'unavailable',
          auth.message,
          {
            ...cors,
            ...(auth.status === 401
              ? { 'WWW-Authenticate': 'Bearer' }
              : { 'Retry-After': '5' }),
          },
        );
      }
      const { user } = auth;
      if (user.isAnonymous || !user.email) {
        return errorResponse(
          403,
          'forbidden',
          'Only people signed in with an email can connect the extension.',
          cors,
        );
      }

      const now = deps.now();
      const personal = deps.perUser.take(user.id, now);
      if (!personal.ok) {
        log('extension_link_rate_limited', { scope: 'user' });
        return errorResponse(
          429,
          'rate_limited',
          'Too many link requests. Wait, then try again.',
          {
            ...cors,
            'Retry-After': String(personal.retryAfterSec),
          },
        );
      }
      const overall = deps.global.take('global', now);
      if (!overall.ok) {
        log('extension_link_rate_limited', { scope: 'global' });
        return errorResponse(
          429,
          'rate_limited',
          'Too many link requests. Wait, then try again.',
          {
            ...cors,
            'Retry-After': String(overall.retryAfterSec),
          },
        );
      }

      let link: MagicLinkResult;
      try {
        link = await deps.generateMagicLink(user.email);
      } catch (error) {
        if (error instanceof Error && error.name === 'MissingEnvError')
          throw error;
        log('extension_link_failed', {
          reason: error instanceof Error ? error.name : 'unknown',
        });
        return errorResponse(
          503,
          'unavailable',
          'Could not create a link right now.',
          { ...cors, 'Retry-After': '5' },
        );
      }

      // The link must belong to the verified caller, never to another account with that email.
      if (
        link.userId !== user.id ||
        link.verificationType !== 'magiclink' ||
        !link.hashedToken
      ) {
        log('extension_link_mismatch', { sameUser: link.userId === user.id });
        return errorResponse(
          500,
          'internal',
          'The link did not match the signed-in person.',
          cors,
        );
      }

      log('extension_link_issued', { user: user.id });
      const payload: ExtensionLinkResponse = {
        tokenHash: link.hashedToken,
        email: user.email,
      };
      return json(payload, { headers: cors });
    } catch (error) {
      if (error instanceof HttpError) return fromHttpError(error, cors);
      if (error instanceof Error && error.name === 'MissingEnvError') {
        log('extension_link_misconfigured', {});
        return errorResponse(
          500,
          'misconfigured',
          'The function is missing configuration.',
          cors,
        );
      }
      log('extension_link_error', {
        reason: error instanceof Error ? error.name : 'unknown',
      });
      return errorResponse(500, 'internal', 'Unexpected error.', cors);
    }
  };
}
