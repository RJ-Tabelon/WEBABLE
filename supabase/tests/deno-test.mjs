#!/usr/bin/env node
// Keep Deno's dependency resolution separate from the pnpm workspace.
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const lock = resolve(root, 'supabase/deno.lock');
const common = ['--no-config', `--lock=${lock}`, '--frozen'];
const env = { ...process.env, DENO_NO_PACKAGE_JSON: '1' };

function run(args) {
  const result = spawnSync('deno', args, { cwd: root, env, stdio: 'inherit' });
  if (result.error) {
    console.error(
      result.error.code === 'ENOENT'
        ? 'Deno is not installed. Install Deno 2.9.8 from https://docs.deno.com/runtime/getting_started/installation/ and add it to PATH.'
        : `Could not start Deno: ${result.error.message}`,
    );
    process.exit(2);
  }
  return result.status ?? 1;
}

const checked = run([
  'check',
  ...common,
  'supabase/functions/extension-link/index.ts',
]);
if (checked !== 0) process.exit(checked);

process.exit(
  run([
    'test',
    ...common,
    ...process.argv.slice(2).filter((argument) => argument !== '--'),
    'supabase/functions/extension-link',
    'supabase/tests/functions',
  ]),
);
