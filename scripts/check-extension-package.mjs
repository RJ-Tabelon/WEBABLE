import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { validateManifest } from './manifest-policy.mjs';

const directory = resolve('apps/extension/.output/chrome-mv3');
const manifest = JSON.parse(await readFile(resolve(directory, 'manifest.json'), 'utf8'));
validateManifest(manifest);
await Promise.all([manifest.action.default_popup, manifest.background.service_worker, 'content-scripts/engine.js'].map(file => access(resolve(directory, file))));
console.log('MV3 package and permission checks passed.');
