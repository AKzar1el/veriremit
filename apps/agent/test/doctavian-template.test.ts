import assert from 'node:assert/strict';
import test from 'node:test';

async function loadTemplate() {
  return import('../src/providers/doctavian-template.ts').catch(() => ({} as Record<string, unknown>));
}

test('Doctavian release template is a deterministic DOCX with structured fields, loop, and calculation', async () => {
  const module = await loadTemplate();
  assert.equal(typeof module.createDoctavianReleaseTemplate, 'function');

  const first = (module.createDoctavianReleaseTemplate as () => Uint8Array)();
  const second = (module.createDoctavianReleaseTemplate as () => Uint8Array)();
  assert.deepEqual(first, second);
  assert.equal(new TextDecoder().decode(first.subarray(0, 2)), 'PK');

  // The template ZIP uses stored entries deliberately so these contract markers remain inspectable.
  const raw = new TextDecoder().decode(first);
  assert.match(raw, /\{!Release\.CaseId\}/);
  assert.match(raw, /\{!Release\.Supplier\}/);
  assert.match(raw, /&lt;mdoc:repeater name=&quot;verification-checks&quot; value=&quot;Release\.Checks&quot; variable=&quot;check&quot;&gt;/);
  assert.match(raw, /#check\.Code#/);
  assert.match(raw, /#check\.Outcome#/);
  assert.match(raw, /\{!\$count\(Release\.Checks\)\}/);
  assert.match(raw, /Foxit eSign sends this packet to a human signer/);
});
