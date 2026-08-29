import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

test('Foxit smoke script refuses to run without explicit credentials', () => {
  const env = { ...process.env };
  delete env.FOXIT_CLIENT_ID;
  delete env.FOXIT_CLIENT_SECRET;

  const result = spawnSync(
    process.execPath,
    ['--experimental-strip-types', 'scripts/smoke-foxit-mcp.ts'],
    { cwd: process.cwd(), env, encoding: 'utf8' },
  );

  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}${result.stderr}`, /FOXIT_CLIENT_ID.*FOXIT_CLIENT_SECRET/);
});
