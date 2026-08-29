import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('agent container is long-lived Node, defaults to fixture mode, and never bakes provider secrets', async () => {
  const dockerfile = await readFile('Dockerfile.agent', 'utf8');
  assert.match(dockerfile, /^FROM node:22\.16\.0-bookworm-slim/m);
  assert.match(dockerfile, /VERIREMIT_PROVIDER_MODE=fixture/);
  assert.match(dockerfile, /npm.*start.*@veriremit\/agent/);
  assert.doesNotMatch(dockerfile, /OPENAI_API_KEY=/);
  assert.doesNotMatch(dockerfile, /NUTRIENT_API_KEY=/);
  assert.doesNotMatch(dockerfile, /FOXIT_CLIENT_SECRET=/);
});
