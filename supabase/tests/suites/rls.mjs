// Row Level Security: own rows only, for every public table, for every verb.

import assert from 'node:assert/strict';

import { OWNED_TABLES, PUBLIC_TABLES, ownerCounts } from '../lib/fixtures.mjs';

export const suite = 'rls';

const RLS_VIOLATION = /row-level security/;

const ownRowTests = OWNED_TABLES.map((table) => ({
  name: `${table.name}: a person can insert, read, update and delete their own rows`,
  async fn(tx) {
    const a = await tx.createUser('a');
    await tx.asUser(a.id);
    assert.equal(await tx.count(table.insert, [a.id]), 1, 'insert');
    assert.equal(
      Number(
        await tx.value(
          `select count(*) from public.${table.name} where user_id = $1`,
          [a.id],
        ),
      ),
      1,
      'select',
    );
    assert.equal(
      await tx.count(
        `update public.${table.name} set ${table.update} where user_id = $1`,
        [a.id],
      ),
      1,
      'update',
    );
    assert.equal(
      await tx.count(`delete from public.${table.name} where user_id = $1`, [
        a.id,
      ]),
      1,
      'delete',
    );
  },
}));

const crossUserTests = OWNED_TABLES.map((table) => ({
  name: `${table.name}: another person's rows cannot be read, written, moved or deleted`,
  async fn(tx) {
    const a = await tx.createUser('a');
    const b = await tx.createUser('b');
    await tx.asUser(b.id);
    await tx.query(table.insert, [b.id]);
    const before = await ownerCounts(tx, b.id);

    await tx.asUser(a.id);
    assert.equal(
      Number(
        await tx.value(
          `select count(*) from public.${table.name} where user_id = $1`,
          [b.id],
        ),
      ),
      0,
      'cross-user select sees nothing',
    );
    assert.equal(
      Number(await tx.value(`select count(*) from public.${table.name}`)),
      0,
      'unfiltered select sees only own rows (none)',
    );
    await tx.expectError(table.insert, [b.id], '42501', RLS_VIOLATION);
    assert.equal(
      await tx.count(
        `update public.${table.name} set ${table.update} where user_id = $1`,
        [b.id],
      ),
      0,
      'cross-user update touches nothing',
    );
    assert.equal(
      await tx.count(`delete from public.${table.name} where user_id = $1`, [
        b.id,
      ]),
      0,
      'cross-user delete touches nothing',
    );

    // Moving an own row to another person is rejected by WITH CHECK.
    await tx.query(table.insert.replace(/'text_size'/, `'line_height'`), [
      a.id,
    ]);
    await tx.expectError(
      `update public.${table.name} set user_id = $2 where user_id = $1`,
      [a.id, b.id],
      '42501',
      RLS_VIOLATION,
    );

    assert.deepEqual(
      await ownerCounts(tx, b.id),
      before,
      "the other person's data is unchanged",
    );
  },
}));

export const tests = [
  {
    name: 'accounts: created by the auth trigger with private defaults',
    async fn(tx) {
      const a = await tx.createUser('a');
      await tx.asUser(a.id);
      const row = await tx.one(
        `select * from public.accounts where user_id = $1`,
        [a.id],
      );
      assert.equal(row.onboarding_step, 'new');
      assert.equal(
        row.cloud_analysis,
        false,
        'cloud analysis is off by default',
      );
      assert.equal(
        row.product_learning,
        false,
        'product learning is off by default',
      );
      assert.equal(row.theme, 'system');
    },
  },
  {
    name: 'accounts: a person can read and update only their own account',
    async fn(tx) {
      const a = await tx.createUser('a');
      const b = await tx.createUser('b');
      await tx.asUser(a.id);
      assert.deepEqual(
        (await tx.rows(`select user_id from public.accounts`)).map(
          (r) => r.user_id,
        ),
        [a.id],
        'sees exactly one account',
      );
      const updatedAt = await tx.value(
        `select updated_at from public.accounts where user_id = $1`,
        [a.id],
      );
      assert.equal(
        await tx.count(
          `update public.accounts set cloud_analysis = true, theme = 'dark' where user_id = $1`,
          [a.id],
        ),
        1,
      );
      const row = await tx.one(
        `select cloud_analysis, theme, updated_at from public.accounts where user_id = $1`,
        [a.id],
      );
      assert.equal(row.cloud_analysis, true);
      assert.equal(row.theme, 'dark');
      assert.ok(row.updated_at >= updatedAt, 'updated_at is touched');
      assert.equal(
        await tx.count(
          `update public.accounts set cloud_analysis = true where user_id = $1`,
          [b.id],
        ),
        0,
        "cannot update another person's account",
      );
      await tx.expectError(
        `update public.accounts set user_id = $2 where user_id = $1`,
        [a.id, b.id],
        '42501',
      );
      await tx.expectError(
        `update public.accounts set theme = 'blue' where user_id = $1`,
        [a.id],
        '23514',
      );
      await tx.asOwner();
      assert.equal(
        await tx.value(
          `select cloud_analysis from public.accounts where user_id = $1`,
          [b.id],
        ),
        false,
      );
    },
  },
  {
    name: 'accounts: people cannot insert or delete account rows',
    async fn(tx) {
      const a = await tx.createUser('a');
      await tx.asUser(a.id);
      await tx.expectError(
        `insert into public.accounts (user_id) values ($1) on conflict do nothing`,
        [a.id],
        '42501',
        /permission denied/,
      );
      await tx.expectError(
        `delete from public.accounts where user_id = $1`,
        [a.id],
        '42501',
        /permission denied/,
      );
    },
  },
  ...ownRowTests,
  ...crossUserTests,
  {
    name: 'anon: every public table denies select, insert, update and delete',
    async fn(tx) {
      const a = await tx.createUser('a');
      await tx.asAnon();
      for (const name of PUBLIC_TABLES) {
        await tx.expectError(
          `select * from public.${name}`,
          [],
          '42501',
          /permission denied/,
        );
        await tx.expectError(
          `update public.${name} set user_id = user_id`,
          [],
          '42501',
          /permission denied/,
        );
        await tx.expectError(
          `delete from public.${name}`,
          [],
          '42501',
          /permission denied/,
        );
      }
      for (const table of OWNED_TABLES) {
        await tx.expectError(
          table.insert,
          [a.id],
          '42501',
          /permission denied/,
        );
      }
    },
  },
  {
    name: 'anon: every RPC is denied',
    async fn(tx) {
      const a = await tx.createUser('a');
      await tx.asAnon();
      const calls = [
        [
          `select public.save_fit_profile('{"v":1}'::jsonb, 'calibration', 'fit-1.0.0')`,
          [],
        ],
        [
          `select * from public.put_learning_state('{}'::jsonb, 0, 'learn-1.0.0')`,
          [],
        ],
        [
          `select public.record_activity(date_trunc('week', now())::date, '{}'::jsonb)`,
          [],
        ],
        [`select public.export_my_data()`, []],
        [`select public.delete_my_account()`, []],
        [`select public.consume_ai_quota($1)`, [a.id]],
      ];
      for (const [sql, params] of calls) {
        await tx.expectError(sql, params, '42501', /permission denied/);
      }
    },
  },
  {
    name: 'private schema: unreachable by authenticated and anon',
    async fn(tx) {
      const a = await tx.createUser('a');
      for (const become of [() => tx.asUser(a.id), () => tx.asAnon()]) {
        await become();
        for (const table of [
          'ai_quota',
          'ai_quota_global',
          'agg_outcome',
          'ingest_quota',
        ]) {
          await tx.expectError(
            `select * from private.${table}`,
            [],
            '42501',
            /permission denied/,
          );
        }
        await tx.expectError(
          `select private.handle_new_user()`,
          [],
          '42501',
          /permission denied/,
        );
      }
    },
  },
  {
    name: 'service_role bypasses RLS (the Edge Function trust boundary)',
    async fn(tx) {
      const a = await tx.createUser('a');
      const b = await tx.createUser('b');
      await tx.asService();
      assert.equal(
        Number(
          await tx.value(
            `select count(*) from public.accounts where user_id = any($1::uuid[])`,
            [[a.id, b.id]],
          ),
        ),
        2,
      );
    },
  },
];
