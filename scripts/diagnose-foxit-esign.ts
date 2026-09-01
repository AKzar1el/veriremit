function required(name: 'FOXIT_CLIENT_ID' | 'FOXIT_CLIENT_SECRET'): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
}

function redact(value: string, secrets: readonly string[]): string {
  let result = value;
  for (const secret of secrets) result = result.replaceAll(secret, '[redacted]');
  return result.slice(0, 1600);
}

async function main(): Promise<void> {
  const clientId = required('FOXIT_CLIENT_ID');
  const clientSecret = required('FOXIT_CLIENT_SECRET');
  const host = (process.env.FOXIT_ESIGN_HOST?.trim() || 'https://na1.fusion.foxit.com').replace(/\/+$/, '');
  const response = await fetch(`${host}/esign/api/v1/folders/createfolder`, {
    method: 'POST',
    headers: {
      client_id: clientId,
      client_secret: clientSecret,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      folderName: 'VeriRemit Foxit activation check',
      inputType: 'url',
      fileUrls: ['https://app.developer-api.foxit.com/esign/foxit-esign-api-sample.pdf'],
      fileNames: ['Foxit eSign sample.pdf'],
      parties: [{
        firstName: 'Test',
        lastName: 'Signer',
        emailId: 'veriremit-activation-check@example.invalid',
        permission: 'FILL_FIELDS_AND_SIGN',
        sequence: 1,
      }],
      processTextTags: false,
      processAcroFields: false,
      createEmbeddedSigningSession: false,
      createEmbeddedSendingSession: true,
      sendNow: false,
    }),
    signal: AbortSignal.timeout(30_000),
  });
  const text = await response.text();
  console.log(`Foxit current-guide draft check: HTTP ${response.status}`);
  if (!response.ok) {
    console.log(`Sanitized Foxit response: ${redact(text, [clientId, clientSecret])}`);
    process.exitCode = 2;
    return;
  }
  let status: unknown;
  try {
    const payload = JSON.parse(text) as { folder?: { folderStatus?: unknown } };
    status = payload.folder?.folderStatus;
  } catch {
    throw new Error('Foxit current-guide draft check returned non-JSON success.');
  }
  console.log(`Foxit current-guide draft creation succeeded${typeof status === 'string' ? ` with status ${status}` : ''}.`);
  console.log('Provider folder identifiers and credentials intentionally not printed.');
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Foxit eSign activation diagnostic failed.');
  process.exitCode = 2;
});
