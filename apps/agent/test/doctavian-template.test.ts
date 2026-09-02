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
  'word/settings.xml',
  'word/styles.xml',
  'word/webextensions/taskpanes.xml',
  'word/webextensions/webextension1.xml',
  'word/webextensions/_rels/taskpanes.xml.rels',
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

test('Doctavian release template preserves the provider-native Maven Word template package', async () => {
  const first = await createDoctavianReleaseTemplate();
  const second = await createDoctavianReleaseTemplate();
  assert.deepEqual(first, second);
  assert.ok(first.byteLength > 0);
  assert.equal(new TextDecoder().decode(first.subarray(0, 2)), 'PK');

  // JSZip independently rejects malformed ZIP packages and lets us verify the exact
  // Maven/Doctavian package parts that were present in the sponsor-provided working template.
  const archive = await JSZip.loadAsync(first);
  for (const part of REQUIRED_PACKAGE_PARTS) {
    assert.ok(archive.file(part), `missing required DOCX package part: ${part}`);
  }

  const contentTypes = await archive.file('[Content_Types].xml')?.async('text');
  const packageRelationships = await archive.file('_rels/.rels')?.async('text');
  const documentXml = await archive.file('word/document.xml')?.async('text');
  const taskpanesXml = await archive.file('word/webextensions/taskpanes.xml')?.async('text');
  const webExtensionXml = await archive.file('word/webextensions/webextension1.xml')?.async('text');
  assert.ok(contentTypes);
  assert.ok(packageRelationships);
  assert.ok(documentXml);
  assert.ok(taskpanesXml);
  assert.ok(webExtensionXml);

  assert.match(contentTypes, /wordprocessingml\.document\.main\+xml/);
  assert.match(packageRelationships, /relationships\/officeDocument/);
  assert.match(taskpanesXml, /webextensionref/i);
  // Maven Documents' Word add-in ID is embedded in the official Mission 1 template that
  // successfully generated a live Doctavian PDF. Preserve it instead of synthesizing DOCX.
  assert.match(webExtensionXml, /WA200008920/);

  const text = documentText(documentXml);
  for (const field of REQUIRED_RELEASE_FIELDS) assert.ok(text.includes(field), `missing merge field: ${field}`);
  assert.ok(text.includes('{!$count(Release.Checks)}'));
  assert.ok(
    text.includes(
      '<mdoc:repeater name="rptr" value="{!Release.Checks}" variable="item" mode="standard">',
    ),
  );
  assert.ok(text.includes('{!#item#.Code}'));
  assert.ok(text.includes('{!#item#.Outcome}'));
  assert.ok(text.includes('{!#item#.Summary}'));
  assert.ok(text.includes('</mdoc:repeater name="rptr">'));
  assert.ok(text.includes('Foxit assembles and routes the packet for human signature'));

  assert.doesNotMatch(text, /DTOKEN|DAPIKEY|Authorization:\s*Bearer|X-Api-Key|Bearer\s+[A-Za-z0-9]/i);
});
