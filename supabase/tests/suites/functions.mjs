// SQL functions: versioned fit saves, optimistic learning-state writes, weekly
// activity, export, account deletion, and the service-only page-analysis quota.

import assert from 'node:assert/strict';

import {
  PROFILE_DOC,
  mondayWeeksAgo,
  ownerCounts,
  seedAllAs,
  OWNED_TABLES,
} from '../lib/fixtures.mjs';

export const suite = 'functions';

const save = (tx, doc = PROFILE_DOC, source = 'calibration') =>
  tx.one(`select * from public.save_fit_profile($1::jsonb, $2, 'fit-1.0.0')`, [
    doc,
    source,
  ]);

const put = (tx, state, expectedRev) =>
  tx.one(
    `select * from public.put_learning_state($1::jsonb, $2, 'learn-1.0.0')`,
    [JSON.stringify(state), expectedRev],
  );

const record = (tx, week, counts) =>
  tx.query(`select public.record_activity($1::date, $2::jsonb)`, [
    week,
    JSON.stringify(counts),
  ]);

export const tests = [
  // ------------------------------------------------------------------ save_fit_profile
  {
    name: 'save_fit_profile: versions increment and exactly one is current',
    async fn(tx) {
      const a = await tx.createUser('a');
      await tx.asUser(a.id);
      const v1 = await save(tx);
      const v2 = await save(tx, PROFILE_DOC, 'adjustment');
      const v3 = await save(tx, PROFILE_DOC, 'recalibration');
      assert.deepEqual([v1.version, v2.version, v3.version], [1, 2, 3]);
      assert.equal(v3.user_id, a.id);
      assert.equal(v3.is_current, true);
      const rows = await tx.rows(
        `select version, is_current from public.fit_profiles where user_id = $1 order by version`,
        [a.id],
      );
      assert.deepEqual(
        rows.map((r) => [r.version, r.is_current]),
        [
          [1, false],
          [2, false],
          [3, true],
        ],
      );
    },
  },
  {
    name: 'save_fit_profile: versions are per person',
    async fn(tx) {
      const a = await tx.createUser('a');
      const b = await tx.createUser('b');
      await tx.asUser(a.id);
      await save(tx);
      await save(tx);
      await tx.asUser(b.id);
      const first = await save(tx);
      assert.equal(first.version, 1);
      assert.equal(first.user_id, b.id);
      await tx.asOwner();
      assert.equal(
        Number(
          await tx.value(
            `select count(*) from public.fit_profiles where user_id = $1 and is_current`,
            [a.id],
          ),
        ),
        1,
      );
    },
  },
  {
    name: 'save_fit_profile: moves onboarding to tuned, never backwards',
    async fn(tx) {
      const a = await tx.createUser('a');
      await tx.asUser(a.id);
      await save(tx);
      assert.equal(
        await tx.value(
          `select onboarding_step from public.accounts where user_id = $1`,
          [a.id],
        ),
        'tuned',
      );
      await tx.query(
        `update public.accounts set onboarding_step = 'connected' where user_id = $1`,
        [a.id],
      );
      await save(tx);
      assert.equal(
        await tx.value(
          `select onboarding_step from public.accounts where user_id = $1`,
          [a.id],
        ),
        'connected',
      );
    },
  },
  {
    name: 'save_fit_profile: rejects bad documents, sources and missing identity',
    async fn(tx) {
      const a = await tx.createUser('a');
      await tx.asUser(a.id);
      const call = `select public.save_fit_profile($1::jsonb, $2, 'fit-1.0.0')`;
      await tx.expectError(call, ['{"v":2}', 'calibration'], '23514');
      await tx.expectError(call, ['[1]', 'calibration'], '23514');
      await tx.expectError(call, [PROFILE_DOC, 'guess'], '23514');
      const big = JSON.stringify({ v: 1, pad: 'x'.repeat(8200) });
      await tx.expectError(call, [big, 'calibration'], '23514');
      await tx.expectError(
        `select public.save_fit_profile($1::jsonb, 'calibration', $2)`,
        [PROFILE_DOC, 'x'.repeat(33)],
        '23514',
      );
      await tx.asAuthenticatedWithoutSub();
      await tx.expectError(
        call,
        [PROFILE_DOC, 'calibration'],
        '42501',
        /not authenticated/,
      );
    },
  },

  // ------------------------------------------------------------------ put_learning_state
  {
    name: 'put_learning_state: optimistic concurrency, conflicts return the current revision',
    async fn(tx) {
      const a = await tx.createUser('a');
      await tx.asUser(a.id);

      const missing = await put(tx, { n: 0 }, 3);
      assert.deepEqual(
        [missing.ok, Number(missing.rev), missing.state],
        [false, 0, null],
        'no row and rev != 0',
      );

      const first = await put(tx, { n: 1 }, 0);
      assert.deepEqual(
        [first.ok, Number(first.rev), first.state],
        [true, 1, { n: 1 }],
      );

      const dupCreate = await put(tx, { n: 99 }, 0);
      assert.deepEqual(
        [dupCreate.ok, Number(dupCreate.rev), dupCreate.state],
        [false, 1, { n: 1 }],
      );

      const second = await put(tx, { n: 2 }, 1);
      assert.deepEqual(
        [second.ok, Number(second.rev), second.state],
        [true, 2, { n: 2 }],
      );

      const stale = await put(tx, { n: 3 }, 1);
      assert.deepEqual(
        [stale.ok, Number(stale.rev), stale.state],
        [false, 2, { n: 2 }],
        'stale writer sees current',
      );

      const stored = await tx.one(
        `select rev, state, engine_version from public.learning_state where user_id = $1`,
        [a.id],
      );
      assert.deepEqual(
        [Number(stored.rev), stored.state, stored.engine_version],
        [2, { n: 2 }, 'learn-1.0.0'],
      );
    },
  },
  {
    name: 'put_learning_state: bounded, per person, and requires identity',
    async fn(tx) {
      const a = await tx.createUser('a');
      const b = await tx.createUser('b');
      await tx.asUser(a.id);
      await put(tx, { owner: 'a' }, 0);
      await tx.asUser(b.id);
      const bFirst = await put(tx, { owner: 'b' }, 0);
      assert.equal(
        bFirst.ok,
        true,
        "b starts at rev 0 regardless of a's state",
      );
      await tx.expectError(
        `select * from public.put_learning_state($1::jsonb, 1, 'learn-1.0.0')`,
        [JSON.stringify({ pad: 'x'.repeat(16400) })],
        '23514',
      );
      await tx.asOwner();
      assert.deepEqual(
        await tx.value(
          `select state from public.learning_state where user_id = $1`,
          [a.id],
        ),
        { owner: 'a' },
      );
      await tx.asAuthenticatedWithoutSub();
      await tx.expectError(
        `select * from public.put_learning_state('{}'::jsonb, 0, 'learn-1.0.0')`,
        [],
        '42501',
        /not authenticated/,
      );
    },
  },

  // ------------------------------------------------------------------ record_activity
  {
    name: 'record_activity: accumulates counts per week and op',
    async fn(tx) {
      const a = await tx.createUser('a');
      const week = await mondayWeeksAgo(tx, 0);
      await tx.asUser(a.id);
      await record(tx, week, {
        text_size: { applied: 2, kept: 1 },
        target_size: { offered: 1 },
      });
      await record(tx, week, {
        text_size: { applied: 3, undone: 1, undone_by_checks: 1, accepted: 2 },
      });
      const rows = await tx.rows(
        `select op, applied, kept, undone, undone_by_checks, offered, accepted
         from public.weekly_activity where user_id = $1 order by op`,
        [a.id],
      );
      assert.deepEqual(rows, [
        {
          op: 'target_size',
          applied: 0,
          kept: 0,
          undone: 0,
          undone_by_checks: 0,
          offered: 1,
          accepted: 0,
        },
        {
          op: 'text_size',
          applied: 5,
          kept: 1,
          undone: 1,
          undone_by_checks: 1,
          offered: 0,
          accepted: 2,
        },
      ]);
    },
  },
  {
    name: 'record_activity: caps each increment at 10000',
    async fn(tx) {
      const a = await tx.createUser('a');
      const week = await mondayWeeksAgo(tx, 0);
      await tx.asUser(a.id);
      await record(tx, week, { text_size: { applied: 999999 } });
      assert.equal(
        await tx.value(
          `select applied from public.weekly_activity where user_id = $1`,
          [a.id],
        ),
        10000,
      );
    },
  },
  {
    name: 'record_activity: negative or non-numeric increments are rejected',
    async fn(tx) {
      const a = await tx.createUser('a');
      const week = await mondayWeeksAgo(tx, 0);
      await tx.asUser(a.id);
      await record(tx, week, { text_size: { applied: 5 } });
      const call = `select public.record_activity($1::date, $2::jsonb)`;
      await tx.expectError(
        call,
        [week, JSON.stringify({ text_size: { applied: -3 } })],
        '23514',
      );
      await tx.expectError(
        call,
        [week, JSON.stringify({ text_size: { applied: 'many' } })],
        '22P02',
      );
      assert.equal(
        await tx.value(
          `select applied from public.weekly_activity where user_id = $1`,
          [a.id],
        ),
        5,
        'counts never go down',
      );
    },
  },
  {
    name: 'record_activity: rejects non-Monday weeks, bad op names and oversized payloads',
    async fn(tx) {
      const a = await tx.createUser('a');
      const monday = await mondayWeeksAgo(tx, 0);
      const tuesday = await tx.value(
        `select to_char($1::date + 1, 'YYYY-MM-DD')`,
        [monday],
      );
      await tx.asUser(a.id);
      const call = `select public.record_activity($1::date, $2::jsonb)`;
      await tx.expectError(
        call,
        [tuesday, JSON.stringify({ text_size: { applied: 1 } })],
        '23514',
      );
      await tx.expectError(
        call,
        [monday, JSON.stringify({ 'Bad-Op': { applied: 1 } })],
        '23514',
      );
      await tx.expectError(
        call,
        [monday, JSON.stringify([1, 2])],
        '22023',
        /invalid counts/,
      );
      const oversized = Object.fromEntries(
        Array.from({ length: 200 }, (_, i) => [
          `op_${String.fromCharCode(97 + (i % 26))}${i}`,
          { applied: 1 },
        ]),
      );
      assert.ok(
        JSON.stringify(oversized).length > 4096,
        'fixture is oversized',
      );
      await tx.expectError(
        call,
        [monday, JSON.stringify(oversized)],
        '22023',
        /invalid counts/,
      );
      assert.equal(
        Number(await tx.value(`select count(*) from public.weekly_activity`)),
        0,
        'nothing written',
      );
    },
  },
  {
    name: 'record_activity: prunes weeks older than 26 weeks, only for the caller',
    async fn(tx) {
      const a = await tx.createUser('a');
      const b = await tx.createUser('b');
      const now = await mondayWeeksAgo(tx, 0);
      const old = await mondayWeeksAgo(tx, 30);
      const recent = await mondayWeeksAgo(tx, 20);
      const insert = `insert into public.weekly_activity (user_id, week, op, applied) values ($1, $2::date, 'text_size', 1)`;
      await tx.asUser(b.id);
      await tx.query(insert, [b.id, old]);
      await tx.asUser(a.id);
      await tx.query(insert, [a.id, old]);
      await tx.query(insert, [a.id, recent]);
      await record(tx, now, { text_size: { applied: 1 } });
      const weeks = await tx.rows(
        `select to_char(week, 'YYYY-MM-DD') as week from public.weekly_activity where user_id = $1 order by week`,
        [a.id],
      );
      assert.deepEqual(
        weeks.map((r) => r.week),
        [recent, now],
      );
      await tx.asOwner();
      assert.equal(
        Number(
          await tx.value(
            `select count(*) from public.weekly_activity where user_id = $1`,
            [b.id],
          ),
        ),
        1,
        "another person's old rows are untouched",
      );
    },
  },
  {
    name: 'record_activity: requires identity',
    async fn(tx) {
      await tx.asAuthenticatedWithoutSub();
      await tx.expectError(
        `select public.record_activity(date_trunc('week', now())::date, '{}'::jsonb)`,
        [],
        '42501',
        /not authenticated/,
      );
    },
  },

  // ------------------------------------------------------------------ export_my_data
  {
    name: 'export_my_data: returns every own row and nothing from anyone else',
    async fn(tx) {
      const a = await tx.createUser('a');
      const b = await tx.createUser('b');
      await seedAllAs(tx, a.id);
      await seedAllAs(tx, b.id);
      await tx.asUser(a.id);
      const doc = await tx.value(`select public.export_my_data()`);
      assert.equal(doc.account.user_id, a.id);
      for (const key of [
        'fit_profiles',
        'calibration_sessions',
        'weekly_activity',
        'extension_installs',
      ]) {
        assert.ok(Array.isArray(doc[key]), `${key} is an array`);
        assert.equal(doc[key].length, 1, `${key} has the one own row`);
        assert.ok(
          doc[key].every((row) => row.user_id === a.id),
          `${key} contains only own rows`,
        );
      }
      assert.equal(doc.learning_state.user_id, a.id);
      assert.ok(
        !JSON.stringify(doc).includes(b.id),
        "b's id appears nowhere in a's export",
      );
      assert.ok(typeof doc.exported_at === 'string');
    },
  },
  {
    name: 'export_my_data: a new account exports empty collections',
    async fn(tx) {
      const a = await tx.createUser('a');
      await tx.asUser(a.id);
      const doc = await tx.value(`select public.export_my_data()`);
      assert.deepEqual(doc.fit_profiles, []);
      assert.deepEqual(doc.calibration_sessions, []);
      assert.deepEqual(doc.weekly_activity, []);
      assert.deepEqual(doc.extension_installs, []);
      assert.equal(doc.learning_state, null);
      assert.equal(doc.account.onboarding_step, 'new');
    },
  },

  // ------------------------------------------------------------------ delete_my_account
  {
    name: 'delete_my_account: removes the auth user and cascades every owned row',
    async fn(tx) {
      const a = await tx.createUser('a');
      const b = await tx.createUser('b');
      await seedAllAs(tx, a.id);
      await seedAllAs(tx, b.id);
      const bBefore = await ownerCounts(tx, b.id);
      await tx.asUser(a.id);
      await tx.query(`select public.delete_my_account()`);
      await tx.asOwner();
      assert.equal(
        Number(
          await tx.value(`select count(*) from auth.users where id = $1`, [
            a.id,
          ]),
        ),
        0,
      );
      const aAfter = await ownerCounts(tx, a.id);
      assert.deepEqual(
        aAfter,
        Object.fromEntries(Object.keys(aAfter).map((k) => [k, 0])),
        'nothing of a remains',
      );
      assert.deepEqual(await ownerCounts(tx, b.id), bBefore, 'b is untouched');
      assert.equal(OWNED_TABLES.length + 1, Object.keys(aAfter).length);
    },
  },
  {
    name: 'delete_my_account: requires identity',
    async fn(tx) {
      await tx.asAuthenticatedWithoutSub();
      await tx.expectError(
        `select public.delete_my_account()`,
        [],
        '42501',
        /not authenticated/,
      );
    },
  },

  // ------------------------------------------------------------------ consume_ai_quota
  {
    name: 'consume_ai_quota: not executable by authenticated',
    async fn(tx) {
      const a = await tx.createUser('a');
      await tx.asUser(a.id);
      await tx.expectError(
        `select public.consume_ai_quota($1)`,
        [a.id],
        '42501',
        /permission denied/,
      );
    },
  },
  {
    name: 'consume_ai_quota: service_role gets 30 per minute per person',
    async fn(tx) {
      const a = await tx.createUser('a');
      const b = await tx.createUser('b');
      await tx.asService();
      // now() is fixed for the transaction, so every call lands in the same minute window.
      const results = await tx.rows(
        `select public.consume_ai_quota($1) as r from generate_series(1, 31)`,
        [a.id],
      );
      assert.equal(results.length, 31);
      const okCount = results.filter((row) => row.r.user_ok).length;
      assert.equal(okCount, 30, '30 allowed, the 31st refused');
      const other = await tx.value(`select public.consume_ai_quota($1)`, [
        b.id,
      ]);
      assert.equal(
        other.user_ok,
        true,
        "one person's limit does not affect another",
      );
    },
  },
  {
    name: 'consume_ai_quota: enforces the daily and product-wide caps and prunes old windows',
    async fn(tx) {
      const a = await tx.createUser('a');
      const b = await tx.createUser('b');
      await tx.asOwner();
      await tx.query(
        `insert into private.ai_quota (user_id, window_start, used)
         values ($1, date_trunc('day', now()), 1500), ($1, now() - interval '3 days', 1)
         on conflict (user_id, window_start) do update set used = excluded.used`,
        [a.id],
      );
      await tx.asService();
      const daily = await tx.value(`select public.consume_ai_quota($1)`, [
        a.id,
      ]);
      assert.equal(daily.user_ok, false, 'over the 1500 daily cap');

      await tx.asOwner();
      assert.equal(
        Number(
          await tx.value(
            `select count(*) from private.ai_quota where user_id = $1 and window_start < now() - interval '2 days'`,
            [a.id],
          ),
        ),
        0,
        'windows older than 2 days are pruned',
      );
      await tx.query(
        `insert into private.ai_quota_global (window_start, used) values (date_trunc('minute', now()), 1000)
         on conflict (window_start) do update set used = 1000`,
      );
      await tx.asService();
      const global = await tx.value(`select public.consume_ai_quota($1)`, [
        b.id,
      ]);
      assert.equal(
        global.global_ok,
        false,
        'over the 1000 per minute product-wide cap',
      );
      assert.equal(global.user_ok, true);
    },
  },
];
