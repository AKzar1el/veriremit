import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import type { VerificationCase } from '@veriremit/domain';

async function loadRuntime() {
  return import('../src/runtime-actions.ts').catch(() => ({} as Record<string, unknown>));
}

test('fixture runtime drives the complete browser-facing verification flow without live provider claims', async () => {
  const module = await loadRuntime();
  assert.equal(typeof module.createFixtureRuntimeActions, 'function');
  const dir = await mkdtemp(join(tmpdir(), 'veriremit-runtime-'));

  try {
    const actions = await (module.createFixtureRuntimeActions as (options: unknown) => Promise<any>)({
      dataDir: dir,
      fixtureDir: 'fixtures/acme-components',
      now: (() => {
        let tick = 0;
        return () => `2026-08-29T02:${String(tick++).padStart(2, '0')}:00.000Z`;
      })(),
    });

    const created = await actions.createDemoCase() as VerificationCase;
    assert.equal(created.status, 'created');

    const reviewed = await actions.extract(created.id) as VerificationCase;
    assert.equal(reviewed.status, 'review_required');
    assert.equal(reviewed.rules.find((rule) => rule.code === 'bank_account_continuity')?.outcome, 'BLOCK');

    const trustedPhone = reviewed.documents
      .find((document) => document.kind === 'vendor_master')
      ?.facts.find((fact) => fact.field === 'trusted_phone');
    assert.ok(trustedPhone);

    const approved = await actions.recordReview(created.id, {
      method: 'trusted_callback',
      trustedContactSource: trustedPhone.source,
      reference: 'VR-2026-4821',
      reviewerName: 'Demo Finance Controller',
      result: 'confirmed',
      recordedAt: '2026-08-29T02:30:00.000Z',
    }) as VerificationCase;
    assert.equal(approved.status, 'human_approved');

    const prepared = await actions.prepareRelease(created.id) as VerificationCase;
    assert.equal(prepared.status, 'release_prepared');
    assert.equal(prepared.releaseDocument?.provider, 'foxit');
    assert.ok(prepared.releaseDocument);
    const releaseBytes = await readFile(join(dir, 'releases', prepared.releaseDocument.filename));
    assert.equal(releaseBytes.subarray(0, 5).toString('ascii'), '%PDF-');

    const pending = await actions.sign(created.id) as VerificationCase;
    assert.equal(pending.status, 'signature_pending');
    assert.equal(pending.signature?.status, 'pending');
    assert.equal(pending.signature?.signingUrl, undefined);

    const completed = await actions.refreshSignature(created.id) as VerificationCase;
    assert.equal(completed.status, 'release_authorized');
    assert.equal(completed.signature?.status, 'completed');

    const audit = await actions.verifyAudit(created.id);
    assert.deepEqual(audit, { valid: true });

    const viewer = await actions.createViewerSession('doc_current_invoice');
    assert.equal(viewer.mode, 'fixture');
    assert.equal(viewer.documentId, 'doc_current_invoice');
    assert.match(viewer.token, /^fixture-session:/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
