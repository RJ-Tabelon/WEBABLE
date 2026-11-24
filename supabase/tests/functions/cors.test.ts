import { assertEquals } from 'jsr:@std/assert@1';

import {
  corsHeaders,
  corsPolicyFromEnv,
  normalizeExtensionOrigin,
  normalizeWebOrigin,
  originRefused,
  parseOriginList,
  preflight,
} from '../../functions/_shared/cors.ts';

const EXT_ID = 'bbnblnlbgcccbbbbihngngbecbobedie';
const env = (values: Record<string, string>) => ({
  get: (n: string) => values[n],
});

Deno.test('normalizeWebOrigin keeps scheme, host and port only', () => {
  assertEquals(
    normalizeWebOrigin('http://localhost:3000/'),
    'http://localhost:3000',
  );
  assertEquals(
    normalizeWebOrigin(' https://app.webable.example/path?q=1 '),
    'https://app.webable.example',
  );
  assertEquals(
    normalizeWebOrigin('https://APP.webable.example:443'),
    'https://app.webable.example',
  );
  assertEquals(normalizeWebOrigin('ftp://example.com'), null);
  assertEquals(normalizeWebOrigin('https://user:pw@example.com'), null);
  assertEquals(normalizeWebOrigin('not a url'), null);
  assertEquals(normalizeWebOrigin(''), null);
});

Deno.test(
  'normalizeExtensionOrigin accepts ids and chrome-extension origins',
  () => {
    assertEquals(
      normalizeExtensionOrigin(EXT_ID),
      `chrome-extension://${EXT_ID}`,
    );
    assertEquals(
      normalizeExtensionOrigin(`chrome-extension://${EXT_ID}/`),
      `chrome-extension://${EXT_ID}`,
    );
    assertEquals(normalizeExtensionOrigin('chrome-extension://short'), null);
    assertEquals(
      normalizeExtensionOrigin('zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz'),
      null,
      'ids use the letters a-p',
    );
  },
);

Deno.test(
  'parseOriginList splits on commas and whitespace and de-duplicates',
  () => {
    assertEquals(
      parseOriginList(
        'http://localhost:3000, http://localhost:3000/ ,https://a.example',
        'web',
      ),
      ['http://localhost:3000', 'https://a.example'],
    );
    assertEquals(
      parseOriginList(`${EXT_ID}\nchrome-extension://${EXT_ID}`, 'extension'),
      [`chrome-extension://${EXT_ID}`],
    );
    assertEquals(parseOriginList(undefined, 'web'), []);
  },
);

Deno.test('corsPolicyFromEnv includes only the requested kinds', () => {
  const values = env({
    WEB_ORIGINS: 'http://localhost:3000',
    EXTENSION_ORIGINS: EXT_ID,
  });
  assertEquals(
    [...corsPolicyFromEnv(values, ['web']).allowed],
    ['http://localhost:3000'],
  );
  assertEquals(
    [...corsPolicyFromEnv(values, ['extension']).allowed],
    [`chrome-extension://${EXT_ID}`],
  );
  assertEquals(corsPolicyFromEnv(values, ['web', 'extension']).allowed.size, 2);
  assertEquals(
    corsPolicyFromEnv(values, ['web'], { methods: ['POST', 'GET'] })
      .allowMethods,
    'POST, GET, OPTIONS',
  );
});

Deno.test(
  'corsHeaders echoes only allowed origins and always varies on Origin',
  () => {
    const policy = corsPolicyFromEnv(
      env({ WEB_ORIGINS: 'http://localhost:3000' }),
      ['web'],
    );
    const allowed = corsHeaders(policy, 'http://localhost:3000');
    assertEquals(
      allowed['Access-Control-Allow-Origin'],
      'http://localhost:3000',
    );
    assertEquals(allowed.Vary, 'Origin');
    const denied = corsHeaders(policy, 'https://evil.example');
    assertEquals(denied['Access-Control-Allow-Origin'], undefined);
    assertEquals(denied.Vary, 'Origin');
    assertEquals(
      corsHeaders(policy, null)['Access-Control-Allow-Origin'],
      undefined,
    );
  },
);

Deno.test('preflight answers OPTIONS only', () => {
  const policy = corsPolicyFromEnv(
    env({ WEB_ORIGINS: 'http://localhost:3000' }),
    ['web'],
    { maxAge: 120 },
  );
  const ok = preflight(
    new Request('http://f', {
      method: 'OPTIONS',
      headers: { origin: 'http://localhost:3000' },
    }),
    policy,
  );
  assertEquals(ok?.status, 204);
  assertEquals(ok?.headers.get('access-control-max-age'), '120');
  const bad = preflight(
    new Request('http://f', {
      method: 'OPTIONS',
      headers: { origin: 'https://evil.example' },
    }),
    policy,
  );
  assertEquals(bad?.status, 403);
  assertEquals(
    preflight(new Request('http://f', { method: 'POST' }), policy),
    null,
  );
});

Deno.test(
  'originRefused allows server callers without Origin and refuses unlisted ones',
  () => {
    const policy = corsPolicyFromEnv(
      env({ WEB_ORIGINS: 'http://localhost:3000' }),
      ['web'],
    );
    assertEquals(
      originRefused(policy, new Request('http://f', { method: 'POST' })),
      false,
    );
    assertEquals(
      originRefused(
        policy,
        new Request('http://f', {
          method: 'POST',
          headers: { origin: 'http://localhost:3000' },
        }),
      ),
      false,
    );
    assertEquals(
      originRefused(
        policy,
        new Request('http://f', {
          method: 'POST',
          headers: { origin: 'null' },
        }),
      ),
      true,
    );
  },
);
