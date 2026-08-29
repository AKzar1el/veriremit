# Live Provider Verification Checklist

Verification date: 2026-08-29

This checklist separates implemented provider adapters from live sponsor verification. A sponsor integration is not considered live-verified until the corresponding command succeeds with environment-provided credentials. No secret values, raw session tokens, signing URLs, or full provider identifiers are recorded here.

## Current status

| Provider | Required live proof | Status | Current blocker |
| --- | --- | --- | --- |
| Nutrient Data Extraction | Extract the synthetic vendor-master PDF and return grounded `iban` and `trusted_phone` facts with page coordinates/confidence | BLOCKED | `NUTRIENT_API_KEY` is not configured in this runtime |
| Nutrient DWS Viewer | Upload the same synthetic document and create a short-lived read-only viewer session | BLOCKED | `NUTRIENT_DWS_VIEWER_API_KEY` is not configured in this runtime |
| Foxit PDF Services via official MCP | Connect to the stdio MCP server, verify the reversible allow-list, upload synthetic HTML, convert it to PDF, and download the result | BLOCKED | `FOXIT_CLIENT_ID` / `FOXIT_CLIENT_SECRET` are not configured in this runtime |
| Foxit eSign direct API | Create a real developer envelope for the configured human signer, complete the signature, and verify authoritative completion through the API | BLOCKED | Foxit credentials, signer email, and explicit smoke PDF are not configured in this runtime |

## Safety rule

If a live check fails because the provider contract, credential scope, quota, or runtime is incompatible, remove or narrow that sponsor claim. Do not substitute fixture behavior and call it live verification.

## Nutrient

Run only with credentials supplied through the environment:

```bash
npm run smoke:nutrient
```

Success evidence to record after execution:

- live extraction succeeded for `fixtures/acme-components/vendor-master.pdf`;
- required grounded fields include `iban` and `trusted_phone`;
- each returned fact used by VeriRemit has a page reference and bounding box;
- DWS upload succeeded;
- a short-lived read-only viewer session was created;
- no document ID or viewer session token was printed or committed.

## Foxit PDF Services MCP

Run only with the unified Foxit developer credentials supplied through the environment:

```bash
npm run smoke:foxit:mcp
```

Success evidence to record after execution:

- the project-installed official Foxit stdio MCP server connects;
- the exposed VeriRemit allow-list contains only `upload_document`, `pdf_from_html`, `pdf_merge`, and `download_document`;
- no signing/eSign capability is available through the MCP boundary;
- a synthetic HTML document is uploaded, converted to PDF, and downloaded successfully.

## Foxit eSign

Set an explicit human signer and smoke PDF, then run:

```bash
npm run smoke:foxit:esign
```

Required environment inputs in addition to Foxit credentials:

- `VERIREMIT_SIGNER_EMAIL` - the human who will actually sign the developer-test envelope;
- `VERIREMIT_ESIGN_SMOKE_PDF` - an explicit local synthetic PDF path.

Success evidence to record after execution:

- a real eSign envelope is created through the direct eSign API, not MCP;
- the human completes the signature;
- final completion is confirmed from Foxit's authoritative envelope-details API;
- embedded signing tokens/URLs are never committed or printed in the verification record.

## Credential-blocked smoke behavior verified

The three smoke runners have also been executed without provider credentials to confirm they fail closed before any provider operation. Missing credentials produce a non-zero exit and a variable-name-only error; no secret value is logged.
