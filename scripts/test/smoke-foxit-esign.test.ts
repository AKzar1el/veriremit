import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

test('Foxit eSign smoke script refuses implicit recipients or documents', () => {
  const env = { ...process.env };
  delete env.FOXIT_CLIENT_ID;
  delete env.FOXIT_CLIENT_SECRET;
  delete env.VERIREMIT_SIGNER_EMAIL;
  delete env.FOXIT_ESIGN_SMOKE_PDF;

  const result = spawnSync(
    process.execPath,
    ['--experimental-strip-types', 'scripts/smoke-foxit-esign.ts'],
    { cwd: process.cwd(), env, encoding: 'utf8' },
  );

  assert.notEqual(result.status, 0);
  const output = `${result.stdout}${result.stderr}`;
  assert.match(output, /FOXIT_CLIENT_ID/);
  assert.match(output, /FOXIT_CLIENT_SECRET/);
  assert.match(output, /VERIREMIT_SIGNER_EMAIL/);
  assert.match(output, /FOXIT_ESIGN_SMOKE_PDF/);
});
