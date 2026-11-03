import { assertEquals } from 'jsr:@std/assert@1';

import {
  type AuthLikeError,
  type AuthVerifier,
  bearerToken,
  type ClaimsResult,
  isInvalidTokenError,
  type UserResult,
  verifyAccessToken,
  verifyRequest,
} from '../../functions/_shared/auth.ts';

const SUB = '6f1c3c1e-3b7a-4c55-9d0e-6a8b7f1d2e3a';
const TOKEN = 'eyJhbGciOiJFUzI1NiJ9.eyJzdWIiOiJ4In0.c2ln';

const claims = (overrides: Record<string, unknown> = {}) => ({
  sub: SUB,
  role: 'authenticated',
  aud: 'authenticated',
  email: 'person@example.com',
  session_id: 'sess-1',
  iss: 'https://ref.supabase.co/auth/v1',
  ...overrides,
});

interface FakeOpts {
  claims?: ClaimsResult | Error;
  user?: UserResult | Error;
}

function fake(opts: FakeOpts): AuthVerifier & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    getClaims: (jwt) => {
      calls.push(`claims:${jwt}`);
      const r = opts.claims ?? {
        data: null,
        error: { name: 'AuthRetryableFetchError', message: 'down', status: 0 },
      };
      return r instanceof Error ? Promise.reject(r) : Promise.resolve(r);
    },
    getUser: (jwt) => {
      calls.push(`user:${jwt}`);
      const r = opts.user ?? {
        data: { user: null },
        error: { name: 'AuthRetryableFetchError', message: 'down', status: 0 },
      };
      return r instanceof Error ? Promise.reject(r) : Promise.resolve(r);
    },
  };
}

const okClaims = (c = claims()): ClaimsResult => ({
  data: { claims: c },
  error: null,
});
const okUser = (
  email: string | null = 'person@example.com',
  id = SUB,
): UserResult => ({
  data: { user: { id, email, is_anonymous: false } },
  error: null,
});
const authError = (e: Partial<AuthLikeError>): AuthLikeError => ({
  message: 'x',
  ...e,
});

Deno.test('bearerToken accepts only well-formed Bearer JWTs', () => {
  const req = (value?: string) =>
    new Request('http://f', { headers: value ? { authorization: value } : {} });
  assertEquals(bearerToken(req(`Bearer ${TOKEN}`)), TOKEN);
  assertEquals(bearerToken(req(`bearer ${TOKEN}`)), TOKEN);
  assertEquals(bearerToken(req()), null);
  assertEquals(bearerToken(req('Basic abc')), null);
  assertEquals(bearerToken(req('Bearer not-a-jwt')), null);
  assertEquals(bearerToken(req(`Bearer ${'a'.repeat(9000)}.b.c`)), null);
});

Deno.test('isInvalidTokenError separates bad tokens from outages', () => {
  assertEquals(
    isInvalidTokenError(
      authError({ name: 'AuthInvalidJwtError', status: 400 }),
    ),
    true,
  );
  assertEquals(
    isInvalidTokenError(
      authError({ name: 'AuthApiError', status: 403, code: 'bad_jwt' }),
    ),
    true,
  );
  assertEquals(
    isInvalidTokenError(
      authError({
        name: 'AuthApiError',
        status: 403,
        code: 'session_not_found',
      }),
    ),
    true,
  );
  assertEquals(
    isInvalidTokenError(
      authError({ name: 'AuthRetryableFetchError', status: 0 }),
    ),
    false,
  );
  assertEquals(
    isInvalidTokenError(authError({ name: 'AuthApiError', status: 500 })),
    false,
  );
  assertEquals(
    isInvalidTokenError(authError({ name: 'AuthApiError', status: 429 })),
    false,
  );
});

Deno.test(
  'valid claims with an email verify locally without calling getUser',
  async () => {
    const v = fake({ claims: okClaims() });
    const result = await verifyAccessToken(TOKEN, v);
    assertEquals(result, {
      ok: true,
      token: TOKEN,
      user: {
        id: SUB,
        email: 'person@example.com',
        isAnonymous: false,
        sessionId: 'sess-1',
      },
    });
    assertEquals(v.calls, [`claims:${TOKEN}`]);
  },
);

Deno.test('requireLiveSession confirms with the Auth server', async () => {
  const v = fake({ claims: okClaims(), user: okUser() });
  const result = await verifyAccessToken(TOKEN, v, {
    requireLiveSession: true,
  });
  assertEquals(result.ok, true);
  assertEquals(v.calls, [`claims:${TOKEN}`, `user:${TOKEN}`]);

  const signedOut = fake({
    claims: okClaims(),
    user: {
      data: { user: null },
      error: authError({
        name: 'AuthApiError',
        status: 403,
        code: 'session_not_found',
      }),
    },
  });
  const refused = await verifyAccessToken(TOKEN, signedOut, {
    requireLiveSession: true,
  });
  assertEquals(refused.ok, false);
  if (!refused.ok)
    assertEquals([refused.status, refused.code], [401, 'invalid_token']);
});

Deno.test('claims without an email are completed from getUser', async () => {
  const v = fake({
    claims: okClaims(claims({ email: undefined })),
    user: okUser('from-user@example.com'),
  });
  const result = await verifyAccessToken(TOKEN, v);
  assertEquals(result.ok && result.user.email, 'from-user@example.com');
});

Deno.test(
  'rejects anon-role, subject-less, wrong-audience and wrong-issuer tokens',
  async () => {
    for (const bad of [
      claims({ role: 'anon' }),
      claims({ sub: undefined }),
      claims({ sub: 'not-a-uuid' }),
      claims({ aud: 'other' }),
    ]) {
      const v = fake({ claims: okClaims(bad), user: okUser() });
      const result = await verifyAccessToken(TOKEN, v);
      assertEquals(result.ok, false);
      if (!result.ok) assertEquals(result.status, 401);
      assertEquals(
        v.calls.length,
        1,
        'no fallback for a token that verified but is not acceptable',
      );
    }
    const wrongIssuer = await verifyAccessToken(
      TOKEN,
      fake({ claims: okClaims() }),
      { issuer: 'https://other.supabase.co/auth/v1' },
    );
    assertEquals(wrongIssuer.ok, false);
    const audArray = await verifyAccessToken(
      TOKEN,
      fake({ claims: okClaims(claims({ aud: ['authenticated', 'x'] })) }),
    );
    assertEquals(audArray.ok, true);
  },
);

Deno.test(
  'an invalid token from getClaims is refused without a getUser round trip',
  async () => {
    const v = fake({
      claims: {
        data: null,
        error: authError({
          name: 'AuthInvalidJwtError',
          status: 400,
          message: 'JWT has expired',
        }),
      },
    });
    const result = await verifyAccessToken(TOKEN, v);
    assertEquals(result.ok, false);
    if (!result.ok) assertEquals(result.code, 'invalid_token');
    assertEquals(v.calls, [`claims:${TOKEN}`]);
  },
);

Deno.test(
  'falls back to getUser when getClaims is unavailable or throws',
  async () => {
    const outage = fake({ user: okUser() });
    assertEquals((await verifyAccessToken(TOKEN, outage)).ok, true);
    assertEquals(outage.calls, [`claims:${TOKEN}`, `user:${TOKEN}`]);

    const thrown = fake({
      claims: new TypeError('fetch failed'),
      user: okUser(),
    });
    const result = await verifyAccessToken(TOKEN, thrown);
    assertEquals(result.ok && result.user.id, SUB);
  },
);

Deno.test('reports 503 when neither path can reach Auth', async () => {
  const result = await verifyAccessToken(TOKEN, fake({}));
  assertEquals(result.ok, false);
  if (!result.ok)
    assertEquals([result.status, result.code], [503, 'auth_unavailable']);
  const thrown = await verifyAccessToken(
    TOKEN,
    fake({ claims: new Error('x'), user: new Error('y') }),
  );
  assertEquals(thrown.ok === false && thrown.status, 503);
});

Deno.test(
  'refuses a session whose user differs from the token subject',
  async () => {
    const v = fake({
      claims: okClaims(),
      user: okUser(
        'person@example.com',
        '00000000-0000-4000-8000-000000000000',
      ),
    });
    const result = await verifyAccessToken(TOKEN, v, {
      requireLiveSession: true,
    });
    assertEquals(result.ok, false);
  },
);

Deno.test(
  'verifyRequest requires a bearer token and honours JWT_ISSUER',
  async () => {
    const env = {
      get: (n: string) =>
        ({
          SUPABASE_URL: 'https://ref.supabase.co',
          JWT_ISSUER: 'https://ref.supabase.co/auth/v1',
        })[n],
    };
    const missing = await verifyRequest(new Request('http://f'), {
      env,
      verifier: fake({}),
    });
    assertEquals(missing.ok === false && missing.code, 'missing_token');

    const req = new Request('http://f', {
      headers: { authorization: `Bearer ${TOKEN}` },
    });
    assertEquals(
      (
        await verifyRequest(req, {
          env,
          verifier: fake({ claims: okClaims() }),
        })
      ).ok,
      true,
    );
    const otherIss = fake({
      claims: okClaims(claims({ iss: 'https://evil.supabase.co/auth/v1' })),
    });
    assertEquals(
      (await verifyRequest(req, { env, verifier: otherIss })).ok,
      false,
    );
  },
);
