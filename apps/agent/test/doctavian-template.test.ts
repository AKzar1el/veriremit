import assert from 'node:assert/strict';
import test from 'node:test';
import JSZip from 'jszip';

import { createDoctavianReleaseTemplate } from '../src/providers/doctavian-template.ts';

const REQUIRED_PACKAGE_PARTS = [
  '[Content_Types].xml',
  '_rels/.rels',
  'docProps/app.xml',
  'docProps/core.xml',
  'word/document.xml',
  'word/_rels/document.xml.rels',
  'word/fontTable.xml',
  'word/numbering.xml',
  'word/settings.xml',
  'word/styles.xml',
] as const;

const REQUIRED_RELEASE_FIELDS = [
  '{!Release.CaseId}',
  '{!Release.Supplier}',
  '{!Release.VendorId}',
  '{!Release.PoNumber}',
  '{!Release.Amount}',
  '{!Release.Currency}',
  '{!Release.Beneficiary}',
  '{!Release.Iban}',
  '{!Release.ReviewerName}',
  '{!Release.VerificationReference}',
  '{!Release.VerifiedAt}',
] as const;

function decodeXmlText(value: string): string {
  return value
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&amp;', '&');
}

function documentText(documentXml: string): string {
  return [...documentXml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)]
    .map((match) => decodeXmlText(match[1] ?? ''))
    .join('\n');
}

test('Doctavian release template has mature-generator package parts and documented merge syntax', async () => {
  const first = await createDoctavianReleaseTemplate();
  const second = await createDoctavianReleaseTemplate();
  assert.deepEqual(first, second);
  assert.ok(first.byteLength > 0);
  assert.equal(new TextDecoder().decode(first.subarray(0, 2)), 'PK');

  // JSZip is independent of the template implementation and rejects malformed ZIP packages.
  const archive = await JSZip.loadAsync(first);
  for (const part of REQUIRED_PACKAGE_PARTS) {
    assert.ok(archive.file(part), `missing required DOCX package part: ${part}`);
  }

  const contentTypes = await archive.file('[Content_Types].xml')?.async('text');
  const packageRelationships = await archive.file('_rels/.rels')?.async('text');
  const documentRelationships = await archive.file('word/_rels/document.xml.rels')?.async('text');
  const documentXml = await archive.file('word/document.xml')?.async('text');
  assert.ok(contentTypes);
  assert.ok(packageRelationships);
  assert.ok(documentRelationships);
  assert.ok(documentXml);

  assert.match(contentTypes, /wordprocessingml\.document\.main\+xml/);
  assert.match(packageRelationships, /relationships\/officeDocument/);
  assert.match(documentRelationships, /relationships\/styles/);
  assert.match(documentRelationships, /relationships\/settings/);

  const text = documentText(documentXml);
  for (const field of REQUIRED_RELEASE_FIELDS) assert.ok(text.includes(field), `missing merge field: ${field}`);
  assert.ok(text.includes('{!$count(Release.Checks)}'));
  assert.ok(
    text.includes(
      '<mdoc:repeater name="verification-checks" value="{!Release.Checks}" variable="check" mode="standard">',
    ),
  );
  assert.ok(text.includes('{!#check#.Code}'));
  assert.ok(text.includes('{!#check#.Outcome}'));
  assert.ok(text.includes('{!#check#.Summary}'));
  assert.ok(text.includes('</mdoc:repeater name="verification-checks">'));
  assert.ok(text.includes('Foxit eSign sends this packet to a human signer'));

  assert.doesNotMatch(text, /DTOKEN|DAPIKEY|Authorization:\s*Bearer|X-Api-Key|Bearer\s+[A-Za-z0-9]/i);
});
