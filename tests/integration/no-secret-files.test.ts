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
  const fakeGroq = ['gsk', 'FAKEabcdefghijklmnopqrstuvwxyz0123456789'].join('_');
  const fakeDoctavianKey = ['DOCTAVIAN_API_KEY', '1234567890abcdef1234567890abcdef'].join('=');
  const fakeDoctavianToken = [
    'DOCTAVIAN_ACCESS_TOKEN',
    ['eyJ', 'hbGciOiJSUzI1NiJ9.fake.payload'].join(''),
  ].join('=');
  const text = [
    'one',
    fakeOpenAi,
    fakeGithub,
    fakeCloudflare,
    fakeGroq,
    fakeDoctavianKey,
    fakeDoctavianToken,
    '',
  ].join('\n');
  const findings = scan(text);

  assert.deepEqual(findings.map((finding) => finding.type).sort(), [
    'cloudflare-api-token',
    'doctavian-access-token',
    'doctavian-api-key',
    'github-fine-grained-token',
    'groq-api-key',
    'openai-project-key',
  ]);
  assert.deepEqual(findings.map((finding) => finding.line).sort((a, b) => a - b), [2, 3, 4, 5, 6, 7]);
  assert.equal(findings.some((finding) => 'value' in finding), false);
  assert.equal(JSON.stringify(findings).includes(fakeOpenAi), false);
  assert.equal(JSON.stringify(findings).includes(fakeGroq), false);
  assert.equal(JSON.stringify(findings).includes(fakeDoctavianKey), false);
  assert.equal(JSON.stringify(findings).includes(fakeDoctavianToken), false);
});

test('secret scanner ignores environment variable placeholders', async () => {
  const module = await loadScanner();
  assert.equal(typeof module.scanTextForSecrets, 'function');
  const scan = module.scanTextForSecrets as (text: string) => unknown[];
  assert.deepEqual(scan([
    'OPENAI_API_KEY=your-key-here',
    'FOXIT_CLIENT_SECRET=replace-me',
    'GROQ_API_KEY=',
    'DOCTAVIAN_API_KEY=',
    'DOCTAVIAN_ACCESS_TOKEN=',
  ].join('\n')), []);
});

test('Foxit eSign smoke output never prints raw provider identifiers or signing URLs', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile('scripts/smoke-foxit-esign.ts', 'utf8');
  assert.doesNotMatch(source, /console\.log\([^\n]*envelope\.envelopeId/);
  assert.doesNotMatch(source, /console\.log\([^\n]*envelope\.signingUrl/);
});
