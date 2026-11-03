import { assertEquals, assertRejects } from 'jsr:@std/assert@1';

import {
  errorResponse,
  HttpError,
  json,
  readJsonBody,
} from '../../functions/_shared/http.ts';

function request(
  body: BodyInit | null,
  headers: Record<string, string> = { 'content-type': 'application/json' },
) {
  return new Request('http://f', { method: 'POST', body, headers });
}

Deno.test('json sets the content type and no-store caching', async () => {
  const res = json({ a: 1 }, { status: 201, headers: { 'X-Extra': 'yes' } });
  assertEquals(res.status, 201);
  assertEquals(
    res.headers.get('content-type'),
    'application/json; charset=utf-8',
  );
  assertEquals(res.headers.get('cache-control'), 'no-store');
  assertEquals(res.headers.get('x-content-type-options'), 'nosniff');
  assertEquals(res.headers.get('x-extra'), 'yes');
  assertEquals(await res.json(), { a: 1 });
});

Deno.test(
  'errorResponse uses the { error: { code, message } } shape',
  async () => {
    const res = errorResponse(429, 'rate_limited', 'Slow down.', {
      'Retry-After': '3',
    });
    assertEquals(res.status, 429);
    assertEquals(res.headers.get('retry-after'), '3');
    assertEquals(await res.json(), {
      error: { code: 'rate_limited', message: 'Slow down.' },
    });
  },
);

Deno.test(
  'readJsonBody parses JSON and treats an empty body as undefined',
  async () => {
    assertEquals(
      await readJsonBody(request('{"a":[1,2]}'), { maxBytes: 100 }),
      { a: [1, 2] },
    );
    assertEquals(
      await readJsonBody(request(null), { maxBytes: 100 }),
      undefined,
    );
    assertEquals(await readJsonBody(request(''), { maxBytes: 100 }), undefined);
  },
);

Deno.test(
  'readJsonBody enforces the byte limit even without Content-Length',
  async () => {
    const declared = await assertRejects(
      () =>
        readJsonBody(request('{"pad":"' + 'x'.repeat(200) + '"}'), {
          maxBytes: 100,
        }),
      HttpError,
    );
    assertEquals(declared.status, 413);

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (let i = 0; i < 10; i += 1)
          controller.enqueue(new TextEncoder().encode('x'.repeat(50)));
        controller.close();
      },
    });
    const streamed = await assertRejects(
      () => readJsonBody(request(stream), { maxBytes: 100 }),
      HttpError,
    );
    assertEquals(streamed.status, 413);
    assertEquals(streamed.code, 'payload_too_large');
  },
);

Deno.test(
  'readJsonBody rejects invalid JSON, wrong types and bad lengths',
  async () => {
    const invalid = await assertRejects(
      () => readJsonBody(request('{oops'), { maxBytes: 100 }),
      HttpError,
    );
    assertEquals(invalid.status, 400);
    const form = await assertRejects(
      () =>
        readJsonBody(
          request('a=1', {
            'content-type': 'application/x-www-form-urlencoded',
          }),
          { maxBytes: 100 },
        ),
      HttpError,
    );
    assertEquals(form.status, 415);
    const badLength = await assertRejects(
      () =>
        readJsonBody(
          request('{}', {
            'content-type': 'application/json',
            'content-length': '-1',
          }),
          { maxBytes: 100 },
        ),
      HttpError,
    );
    assertEquals(badLength.status, 400);
  },
);
