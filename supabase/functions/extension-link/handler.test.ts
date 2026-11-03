// deno test supabase/functions/extension-link
import { assert, assertEquals, assertMatch } from 'jsr:@std/assert@1';

import type { AuthResult, VerifiedUser } from '../_shared/auth.ts';
import { corsPolicyFromEnv } from '../_shared/cors.ts';
import {
  createHandler,
  type ExtensionLinkDeps,
  type MagicLinkResult,
} from './handler.ts';
import { createRateLimiter } from './rate-limit.ts';

const WEB = 'http://localhost:3000';
const USER: VerifiedUser = {
  id: '6f1c3c1e-3b7a-4c55-9d0e-6a8b7f1d2e3a',
  email: 'person@example.com',
  isAnonymous: false,
  sessionId: 'b0e1d8a4-9a4f-4a55-8a34-0c5b0d1e2f3a',
};
const HASH = 'a3f1c9e0b8d7c6e5f4a3b2c1d0e9f8a7b6c5d4e3f2a1b0c9d8e7f6a5';

const env = (values: Record<string, string>) => ({
  get: (n: string) => values[n],
});

interface Harness {
  deps: ExtensionLinkDeps;
  calls: { verify: number; link: string[]; logs: string[] };
}

function harness(
  overrides: Partial<ExtensionLinkDeps> = {},
  auth: AuthResult = { ok: true, user: USER, token: 't' },
): Harness {
  const calls = { verify: 0, link: [] as string[], logs: [] as string[] };
  const deps: ExtensionLinkDeps = {
    cors: corsPolicyFromEnv(
      env({
        WEB_ORIGINS: `${WEB}, https://app.webable.example`,
        EXTENSION_ORIGINS: 'bbnblnlbgcccbbbbihngngbecbobedie',
      }),
      ['web'],
    ),
    verify: () => {
      calls.verify += 1;
      return Promise.resolve(auth);
    },
    generateMagicLink: (email): Promise<MagicLinkResult> => {
      calls.link.push(email);
      return Promise.resolve({
        hashedToken: HASH,
        userId: USER.id,
        verificationType: 'magiclink',
      });
    },
    perUser: createRateLimiter({ limit: 5, windowMs: 60_000 }),
    global: createRateLimiter({ limit: 100, windowMs: 60_000 }),
    now: () => 1_000_000,
    log: (event) => {
      calls.logs.push(event);
    },
    ...overrides,
  };
  return { deps, calls };
}

function post(
  init: {
    origin?: string | null;
    body?: BodyInit | null;
    headers?: Record<string, string>;
  } = {},
): Request {
  const headers = new Headers({
    authorization: 'Bearer a.b.c',
    ...init.headers,
  });
  if (init.origin !== null) headers.set('origin', init.origin ?? WEB);
  if (
    init.body !== undefined &&
    init.body !== null &&
    !headers.has('content-type')
  ) {
    headers.set('content-type', 'application/json');
  }
  return new Request('http://functions.local/extension-link', {
    method: 'POST',
    headers,
    body: init.body ?? null,
  });
}

Deno.test('issues a token hash bound to the verified caller', async () => {
  const { deps, calls } = harness();
  const res = await createHandler(deps)(post({ body: '{}' }));
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { tokenHash: HASH, email: USER.email });
  assertEquals(calls.link, [USER.email]);
  assertEquals(res.headers.get('access-control-allow-origin'), WEB);
  assertEquals(res.headers.get('cache-control'), 'no-store');
  assertEquals(res.headers.get('vary'), 'Origin');
  assertEquals(calls.logs, ['extension_link_issued']);
});

Deno.test(
  'accepts an empty body and server-side callers without an Origin',
  async () => {
    const { deps } = harness();
    const res = await createHandler(deps)(post({ origin: null }));
    assertEquals(res.status, 200);
    assertEquals(res.headers.get('access-control-allow-origin'), null);
  },
);

Deno.test('answers preflight only for web origins', async () => {
  const { deps } = harness();
  const handle = createHandler(deps);
  const ok = await handle(
    new Request('http://f/extension-link', {
      method: 'OPTIONS',
      headers: { origin: WEB },
    }),
  );
  assertEquals(ok.status, 204);
  assertEquals(ok.headers.get('access-control-allow-origin'), WEB);
  assertMatch(
    ok.headers.get('access-control-allow-headers') ?? '',
    /authorization/,
  );
  assertMatch(ok.headers.get('access-control-allow-methods') ?? '', /POST/);

  const ext = await handle(
    new Request('http://f/extension-link', {
      method: 'OPTIONS',
      headers: {
        origin: 'chrome-extension://bbnblnlbgcccbbbbihngngbecbobedie',
      },
    }),
  );
  assertEquals(ext.status, 403, 'the extension never calls this function');
  assertEquals(ext.headers.get('access-control-allow-origin'), null);
});

Deno.test('refuses unlisted origins before verifying anything', async () => {
  const { deps, calls } = harness();
  const res = await createHandler(deps)(
    post({ origin: 'https://evil.example', body: '{}' }),
  );
  assertEquals(res.status, 403);
  assertEquals((await res.json()).error.code, 'forbidden_origin');
  assertEquals(calls.verify, 0);
  assertEquals(calls.link, []);
});

Deno.test('only POST is allowed', async () => {
  const { deps } = harness();
  const res = await createHandler(deps)(
    new Request('http://f/extension-link', {
      method: 'GET',
      headers: { origin: WEB },
    }),
  );
  assertEquals(res.status, 405);
  assertEquals(res.headers.get('allow'), 'POST, OPTIONS');
});

Deno.test('rejects bodies other than {} and oversized bodies', async () => {
  const { deps, calls } = harness();
  const handle = createHandler(deps);
  const extra = await handle(post({ body: '{"email":"other@example.com"}' }));
  assertEquals(extra.status, 400);
  const notJson = await handle(post({ body: '{nope' }));
  assertEquals(notJson.status, 400);
  const wrongType = await handle(
    post({
      body: 'x=1',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
    }),
  );
  assertEquals(wrongType.status, 415);
  const big = await handle(
    post({ body: JSON.stringify({ pad: 'x'.repeat(2000) }) }),
  );
  assertEquals(big.status, 413);
  assertEquals(calls.link, [], 'no link is minted for a bad request');
});

Deno.test(
  'returns 401 with WWW-Authenticate when the token is invalid',
  async () => {
    const { deps, calls } = harness(
      {},
      {
        ok: false,
        status: 401,
        code: 'invalid_token',
        message: 'Session is not valid.',
      },
    );
    const res = await createHandler(deps)(post({ body: '{}' }));
    assertEquals(res.status, 401);
    assertEquals(res.headers.get('www-authenticate'), 'Bearer');
    assertEquals((await res.json()).error.code, 'unauthorized');
    assertEquals(calls.link, []);
  },
);

Deno.test('returns 503 when Auth cannot be reached', async () => {
  const { deps } = harness(
    {},
    { ok: false, status: 503, code: 'auth_unavailable', message: 'down' },
  );
  const res = await createHandler(deps)(post({ body: '{}' }));
  assertEquals(res.status, 503);
  assertEquals(res.headers.get('retry-after'), '5');
});

Deno.test('refuses anonymous or email-less sessions', async () => {
  for (const user of [
    { ...USER, isAnonymous: true },
    { ...USER, email: null },
  ]) {
    const { deps, calls } = harness({}, { ok: true, user, token: 't' });
    const res = await createHandler(deps)(post({ body: '{}' }));
    assertEquals(res.status, 403);
    assertEquals(calls.link, []);
  }
});

Deno.test('limits each person to 5 links a minute', async () => {
  let now = 0;
  const { deps, calls } = harness({ now: () => now });
  const handle = createHandler(deps);
  for (let i = 0; i < 5; i += 1) {
    now += 1000;
    assertEquals((await handle(post({ body: '{}' }))).status, 200);
  }
  now += 1000;
  const limited = await handle(post({ body: '{}' }));
  assertEquals(limited.status, 429);
  assert(Number(limited.headers.get('retry-after')) >= 1);
  assertEquals(calls.link.length, 5);
  now += 60_000;
  assertEquals(
    (await handle(post({ body: '{}' }))).status,
    200,
    'the window slides',
  );
});

Deno.test('the per-isolate ceiling applies across people', async () => {
  const { deps } = harness({
    global: createRateLimiter({ limit: 1, windowMs: 60_000 }),
  });
  const handle = createHandler(deps);
  assertEquals((await handle(post({ body: '{}' }))).status, 200);
  assertEquals((await handle(post({ body: '{}' }))).status, 429);
});

Deno.test('never returns a link minted for a different account', async () => {
  const { deps, calls } = harness({
    generateMagicLink: () =>
      Promise.resolve({
        hashedToken: HASH,
        userId: '00000000-0000-4000-8000-000000000000',
        verificationType: 'magiclink',
      }),
  });
  const res = await createHandler(deps)(post({ body: '{}' }));
  assertEquals(res.status, 500);
  const text = await res.text();
  assert(!text.includes(HASH), 'the hash is not leaked');
  assertEquals(calls.logs, ['extension_link_mismatch']);
});

Deno.test('maps admin API failures to 503 without details', async () => {
  const { deps } = harness({
    generateMagicLink: () => Promise.reject(new Error('boom: secret detail')),
  });
  const res = await createHandler(deps)(post({ body: '{}' }));
  assertEquals(res.status, 503);
  const text = await res.text();
  assert(!text.includes('secret detail'));
});

Deno.test('missing configuration is reported as misconfigured', async () => {
  const missing = new Error(
    'Missing environment variable SUPABASE_SERVICE_ROLE_KEY.',
  );
  missing.name = 'MissingEnvError';
  const { deps } = harness({
    generateMagicLink: () => Promise.reject(missing),
  });
  const res = await createHandler(deps)(post({ body: '{}' }));
  assertEquals(res.status, 500);
  assertEquals((await res.json()).error.code, 'misconfigured');
});
