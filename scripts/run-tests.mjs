import { readdirSync, statSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { spawnSync } from 'node:child_process';

const roots = ['packages', 'apps', 'tests/integration'];
const files = [];

function walk(path) {
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    const full = resolve(path, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue;
      walk(full);
    } else if (entry.isFile() && entry.name.endsWith('.test.ts')) {
      files.push(relative(process.cwd(), full));
    }
  }
}

for (const root of roots) {
  if (statSync(resolve(root), { throwIfNoEntry: false })?.isDirectory()) walk(root);
}
files.sort();
if (files.length === 0) {
  console.error('No test files found.');
  process.exit(1);
}

const result = spawnSync(process.execPath, ['--experimental-strip-types', '--test', ...files], {
  stdio: 'inherit',
});
process.exit(result.status ?? 1);
