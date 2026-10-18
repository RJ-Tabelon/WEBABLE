// Structural lint over the live catalog: RLS everywhere, policies scoped to a
// role and written in the cached `(select auth.uid())` form, safe functions,
// indexed policy columns, and no Data API grants that would bypass RLS.

import assert from 'node:assert/strict';

export const suite = 'structure';

export const tests = [
  {
    name: 'every public and private table has RLS enabled',
    async fn(tx) {
      const rows = await tx.rows(`
        select n.nspname as schema, c.relname as table
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname in ('public', 'private') and c.relkind in ('r', 'p')
          and not c.relrowsecurity
        order by 1, 2`);
      assert.deepEqual(
        rows.map((r) => `${r.schema}.${r.table}`),
        [],
        'tables without RLS',
      );
    },
  },
  {
    name: 'every public table has at least one policy',
    async fn(tx) {
      const rows = await tx.rows(`
        select c.relname as table
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind in ('r', 'p')
          and not exists (select 1 from pg_policy p where p.polrelid = c.oid)
        order by 1`);
      assert.deepEqual(
        rows.map((r) => r.table),
        [],
        'public tables with no policy',
      );
    },
  },
  {
    name: 'public policies apply to named roles, never PUBLIC or anon',
    async fn(tx) {
      const rows = await tx.rows(`
        select tablename, policyname, roles::text[] as roles
        from pg_policies where schemaname = 'public'
          and ('public' = any(roles) or 'anon' = any(roles))
        order by 1, 2`);
      assert.deepEqual(
        rows.map(
          (r) => `${r.tablename}.${r.policyname} -> ${r.roles.join(',')}`,
        ),
        [],
      );
    },
  },
  {
    name: 'policies use the cached (select auth.uid()) form',
    async fn(tx) {
      const rows = await tx.rows(`
        select tablename, policyname,
               coalesce(qual, '') || ' ' || coalesce(with_check, '') as expr
        from pg_policies where schemaname = 'public'`);
      const bare = rows.filter((r) => {
        const occurrences = r.expr.match(/auth\.uid\(\)/g)?.length ?? 0;
        const wrapped = r.expr.match(/SELECT auth\.uid\(\)/gi)?.length ?? 0;
        return occurrences !== wrapped;
      });
      assert.deepEqual(
        bare.map((r) => `${r.tablename}.${r.policyname}`),
        [],
        'policies calling auth.uid() per row',
      );
    },
  },
  {
    name: 'every user_id column leads a btree index',
    async fn(tx) {
      const rows = await tx.rows(`
        select c.relname as table
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        join pg_attribute a on a.attrelid = c.oid and a.attname = 'user_id' and not a.attisdropped
        where n.nspname = 'public' and c.relkind = 'r'
          and not exists (
            select 1 from pg_index i
            join pg_class ic on ic.oid = i.indexrelid
            join pg_am am on am.oid = ic.relam
            where i.indrelid = c.oid and am.amname = 'btree' and i.indkey[0] = a.attnum
          )
        order by 1`);
      assert.deepEqual(
        rows.map((r) => r.table),
        [],
        'user_id without a leading index',
      );
    },
  },
  {
    name: 'anon holds no table privileges in public',
    async fn(tx) {
      const rows = await tx.rows(`
        select table_name, privilege_type from information_schema.role_table_grants
        where table_schema = 'public' and grantee = 'anon' order by 1, 2`);
      assert.deepEqual(
        rows.map((r) => `${r.table_name}:${r.privilege_type}`),
        [],
      );
    },
  },
  {
    name: 'the private schema is not usable by anon or authenticated',
    async fn(tx) {
      const row = await tx.one(`
        select has_schema_privilege('anon', 'private', 'usage') as anon,
               has_schema_privilege('authenticated', 'private', 'usage') as authenticated`);
      assert.equal(row.anon, false);
      assert.equal(row.authenticated, false);
    },
  },
  {
    name: 'security definer functions pin search_path',
    async fn(tx) {
      const rows = await tx.rows(`
        select n.nspname || '.' || p.proname as fn
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname in ('public', 'private') and p.prosecdef
          and not exists (
            select 1 from unnest(coalesce(p.proconfig, '{}')) cfg where cfg like 'search_path=%'
          )`);
      assert.deepEqual(
        rows.map((r) => r.fn),
        [],
      );
    },
  },
  {
    name: 'function execute grants match the contract',
    async fn(tx) {
      const rows = await tx.rows(`
        select p.proname as fn,
               has_function_privilege('anon', p.oid, 'execute') as anon,
               has_function_privilege('authenticated', p.oid, 'execute') as authed,
               has_function_privilege('service_role', p.oid, 'execute') as service
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname in ('public', 'private') and p.prokind = 'f'`);
      const byName = Object.fromEntries(rows.map((r) => [r.fn, r]));
      for (const fn of [
        'save_fit_profile',
        'put_learning_state',
        'record_activity',
        'export_my_data',
        'delete_my_account',
      ]) {
        assert.ok(byName[fn], `${fn} exists`);
        assert.equal(byName[fn].anon, false, `${fn}: anon must not execute`);
        assert.equal(byName[fn].authed, true, `${fn}: authenticated executes`);
      }
      assert.equal(
        byName.consume_ai_quota.anon,
        false,
        'consume_ai_quota: anon',
      );
      assert.equal(
        byName.consume_ai_quota.authed,
        false,
        'consume_ai_quota: authenticated',
      );
      assert.equal(
        byName.consume_ai_quota.service,
        true,
        'consume_ai_quota: service_role',
      );
      for (const fn of ['handle_new_user', 'touch_updated_at']) {
        assert.equal(byName[fn].anon, false, `${fn}: anon`);
        assert.equal(byName[fn].authed, false, `${fn}: authenticated`);
      }
    },
  },
  {
    name: 'the account trigger is attached to auth.users',
    async fn(tx) {
      const row = await tx.one(`
        select count(*)::int as n from pg_trigger
        where tgrelid = 'auth.users'::regclass and tgname = 'on_auth_user_created'
          and not tgisinternal and tgenabled <> 'D'`);
      assert.equal(row.n, 1);
    },
  },
  {
    // Advisory: TRUNCATE ignores RLS. PostgREST cannot issue it, so this is not
    // reachable through the Data API, but revoking it is cheap defense in depth.
    name: 'authenticated holds no RLS-bypassing TRUNCATE grant',
    advisory: true,
    async fn(tx) {
      const rows = await tx.rows(`
        select table_name from information_schema.role_table_grants
        where table_schema = 'public' and grantee = 'authenticated' and privilege_type = 'TRUNCATE'
        order by 1`);
      assert.deepEqual(
        rows.map((r) => r.table_name),
        [],
        'revoke truncate on all tables in schema public from authenticated',
      );
    },
  },
];
