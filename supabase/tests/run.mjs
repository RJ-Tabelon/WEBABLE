#!/usr/bin/env node
// RLS and SQL function suite against a real Postgres (the live project or a branch).
//
//   pnpm db:test                     run everything
//   pnpm db:test -- --grep quota     run tests whose "suite: name" matches a pattern
//   pnpm db:test -- --bail           stop at the first failure
//
// Reads SUPABASE_DIRECT_URL (or DB_TEST_URL) from the root .env and switches the
// pooler to session mode (:5432). Every test runs inside BEGIN ... ROLLBACK, so
// the suite leaves no rows, users or quota counts behind. Exit code: 0 when every
// test passes, 1 on any failure, 2 when the database cannot be reached.

import { performance } from 'node:perf_hooks';

import { connect, inRollback, resolveDbUrl } from './lib/db.mjs';
import * as constraints from './suites/constraints.mjs';
import * as functions from './suites/functions.mjs';
import * as rls from './suites/rls.mjs';
import * as round1 from './suites/round1.mjs';
import * as structure from './suites/structure.mjs';

const SUITES = [structure, rls, functions, constraints, round1];

function parseArgs(argv) {
  const args = { grep: null, bail: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--bail') args.bail = true;
    else if (arg === '--grep') args.grep = new RegExp(argv[++i] ?? '', 'i');
    else if (arg.startsWith('--grep='))
      args.grep = new RegExp(arg.slice(7), 'i');
    else if (arg === '--') continue;
    else {
      console.error(`Unknown argument: ${arg}`);
      process.exit(2);
    }
  }
  return args;
}

/** Keep failure output useful without echoing connection strings or secrets. */
function describeError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/postgres(ql)?:\/\/[^\s]+/g, '<database url>');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const url = resolveDbUrl();
  if (!url) {
    console.error(
      'SUPABASE_DIRECT_URL is not set. Add it to the root .env (see .env.example).',
    );
    process.exit(2);
  }

  let client;
  try {
    client = await connect(url);
  } catch (error) {
    console.error(`Could not connect to the database: ${describeError(error)}`);
    process.exit(2);
  }

  const results = { passed: 0, failed: 0, warned: 0, skipped: 0 };
  const failures = [];
  const started = performance.now();
  let bailed = false;

  for (const mod of SUITES) {
    const selected = mod.tests.filter(
      (t) => !args.grep || args.grep.test(`${mod.suite}: ${t.name}`),
    );
    if (selected.length === 0) continue;
    console.log(`\n${mod.suite}`);
    for (const test of selected) {
      if (bailed) {
        results.skipped += 1;
        continue;
      }
      const t0 = performance.now();
      try {
        await inRollback(client, test.fn);
        results.passed += 1;
        console.log(
          `  ok    ${test.name} (${Math.round(performance.now() - t0)} ms)`,
        );
      } catch (error) {
        if (test.advisory) {
          results.warned += 1;
          console.log(`  warn  ${test.name}`);
          console.log(
            `        ${describeError(error).split('\n').join('\n        ')}`,
          );
        } else {
          results.failed += 1;
          failures.push({ suite: mod.suite, name: test.name, error });
          console.log(`  FAIL  ${test.name}`);
          console.log(
            `        ${describeError(error).split('\n').join('\n        ')}`,
          );
          if (args.bail) bailed = true;
        }
      }
    }
  }

  await client.end().catch(() => {});

  const seconds = ((performance.now() - started) / 1000).toFixed(1);
  const total = results.passed + results.failed;
  console.log('\n' + '-'.repeat(60));
  console.log(
    `${results.failed === 0 ? 'PASS' : 'FAIL'}  ${results.passed}/${total} passed` +
      (results.warned ? `, ${results.warned} advisory warning(s)` : '') +
      (results.skipped ? `, ${results.skipped} skipped` : '') +
      ` in ${seconds} s. All changes were rolled back.`,
  );
  if (failures.length) {
    console.log('\nFailed:');
    for (const f of failures) console.log(`  - ${f.suite}: ${f.name}`);
  }
  process.exit(results.failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(`Unexpected error: ${describeError(error)}`);
  process.exit(1);
});
