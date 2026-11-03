import { assertEquals, assertThrows } from 'jsr:@std/assert@1';

import { createRateLimiter } from './rate-limit.ts';

Deno.test(
  'allows up to the limit inside the window, then reports when to retry',
  () => {
    const limiter = createRateLimiter({ limit: 3, windowMs: 10_000 });
    assertEquals(limiter.take('a', 0).ok, true);
    assertEquals(limiter.take('a', 1_000).ok, true);
    assertEquals(limiter.take('a', 2_000).ok, true);
    assertEquals(limiter.take('a', 3_000), { ok: false, retryAfterSec: 7 });
    assertEquals(limiter.take('b', 3_000).ok, true, 'keys are independent');
    assertEquals(
      limiter.take('a', 10_001).ok,
      true,
      'the oldest hit left the window',
    );
  },
);

Deno.test('refused attempts do not extend the window', () => {
  const limiter = createRateLimiter({ limit: 1, windowMs: 1_000 });
  assertEquals(limiter.take('a', 0).ok, true);
  for (let t = 100; t < 1_000; t += 100)
    assertEquals(limiter.take('a', t).ok, false);
  assertEquals(limiter.take('a', 1_001).ok, true);
});

Deno.test('evicts the least recently used keys beyond maxKeys', () => {
  const limiter = createRateLimiter({ limit: 1, windowMs: 60_000, maxKeys: 2 });
  limiter.take('a', 0);
  limiter.take('b', 1);
  limiter.take('c', 2);
  assertEquals(
    limiter.take('a', 3).ok,
    true,
    'a was evicted, so it starts fresh',
  );
  assertEquals(limiter.take('c', 4).ok, false, 'c is still tracked');
});

Deno.test('rejects nonsensical configuration', () => {
  assertThrows(() => createRateLimiter({ limit: 0, windowMs: 1 }), RangeError);
  assertThrows(() => createRateLimiter({ limit: 1, windowMs: 0 }), RangeError);
});
