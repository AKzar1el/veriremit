import assert from 'node:assert/strict';
import test from 'node:test';

async function loadScanner() {
  return import('../../scripts/check-secrets.mjs').catch(() => ({} as Record<string, unknown>));
}

test('secret scanner detects high-risk token families without returning the credential value', async () => {
  const module = await loadScanner();
  assert.equal(typeof module.scanTextForSecrets, 'function');
  const scan = module.scanTextForSecrets as (text: string) => Array<{ type: string; line: number; value?: string }>;

  const fakeOpenAi = ['sk', 'proj', 'abcdefghijklmnopqrstuvwxyz0123456789'].join('-');
  const fakeGithub = ['github', 'pat', '11FAKEabcdefghijklmnopqrstuv123456789'].join('_');
  const fakeCloudflare = ['cfut', 'FAKEabcdefghijklmnopqrstuv123456789'].join('_');
  const text = `one\n${fakeOpenAi}\n${fakeGithub}\n${fakeCloudflare}\n`;
  const findings = scan(text);

  assert.deepEqual(findings.map((finding) => finding.type).sort(), [
    'cloudflare-api-token',
    'github-fine-grained-token',
    'openai-project-key',
  ]);
  assert.deepEqual(findings.map((finding) => finding.line).sort((a, b) => a - b), [2, 3, 4]);
  assert.equal(findings.some((finding) => 'value' in finding), false);
  assert.equal(JSON.stringify(findings).includes(fakeOpenAi), false);
});

test('secret scanner ignores environment variable placeholders', async () => {
  const module = await loadScanner();
  assert.equal(typeof module.scanTextForSecrets, 'function');
  const scan = module.scanTextForSecrets as (text: string) => unknown[];
  assert.deepEqual(scan('OPENAI_API_KEY=your-key-here\nFOXIT_CLIENT_SECRET=replace-me\n'), []);
});

test('Foxit eSign smoke output never prints raw provider identifiers or signing URLs', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile('scripts/smoke-foxit-esign.ts', 'utf8');
  assert.doesNotMatch(source, /console\.log\([^\n]*envelope\.envelopeId/);
  assert.doesNotMatch(source, /console\.log\([^\n]*envelope\.signingUrl/);
});
