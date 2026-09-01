# Live Provider Verification Checklist

Verification date: 2026-09-01

This checklist separates implemented provider adapters from live sponsor verification. A provider integration is not considered live-verified until the corresponding command or end-to-end step succeeds with environment-provided credentials. No secret values, raw session tokens, signing URLs, OAuth tokens, or full provider identifiers are recorded here.

## Current status

| Provider | Required live proof | Status | Current blocker |
| --- | --- | --- | --- |
| Groq bounded reviewer | Execute the real four-tool reviewer with `openai/gpt-oss-120b` through Groq's OpenAI-compatible endpoint | NOT VERIFIED | Credential exists outside the repository but is not injected into this runtime |
| Nutrient Data Extraction | Extract the synthetic vendor-master PDF and return grounded `iban` and `trusted_phone` facts with page coordinates/confidence | NOT VERIFIED | Credential exists outside the repository but is not injected into this runtime |
| Nutrient DWS Viewer | Upload the same synthetic document and create a short-lived read-only viewer session | NOT VERIFIED | Viewer backend credential exists outside the repository but is not injected into this runtime |
| Doctavian | Upload the deterministic DOCX template + structured release JSON, generate a PDF, and download it | BLOCKED | Provisioned API key exists; required OAuth bearer token has not yet been obtained |
| Foxit PDF Services via official MCP | Connect to the stdio MCP server, verify the reversible allow-list, and assemble/download the final packet | NOT VERIFIED | Developer credentials exist outside the repository but are not injected into this runtime |
| Foxit eSign direct API | Create a real envelope for the configured human signer, complete the signature, and verify authoritative completion through the API | NOT VERIFIED / HUMAN STEP | Credentials/signer are known; real envelope and human completion still required |

## Safety rule

If a live check fails because the provider contract, credential scope, quota, or runtime is incompatible, remove or narrow that provider/sponsor claim. Do not substitute fixture behavior and call it live verification.

## Groq bounded reviewer

The production reviewer uses the OpenAI Agents SDK with a Groq-backed `OpenAIProvider` when `GROQ_API_KEY` is present. The model is `openai/gpt-oss-120b`; tracing is disabled; the run is capped at three turns; the tool surface is restricted to:

- `get_case_summary`;
- `extract_case`;
- `prepare_release`;
- `request_human_signature`.

Success evidence for the final live run:

- a plain-language prompt reaches the real Groq model;
- the model uses only the bounded case-scoped tools;
- deterministic server policy still produces the PASS/BLOCK outcome;
- the model cannot approve the bank change, sign, execute arbitrary HTTP, or authorize payment.

## Nutrient

Run only with credentials supplied through the environment:

```bash
npm run smoke:nutrient
```

Success evidence to record after execution:

- live extraction succeeds for `fixtures/acme-components/vendor-master.pdf`;
- required grounded fields include `iban` and `trusted_phone`;
- each returned fact used by VeriRemit has a page reference and bounding box;
- DWS upload succeeds;
- a short-lived read-only viewer session is created;
- no document ID or viewer session token is printed or committed.

The extraction client sends the currently documented `instructions: { schema }` multipart envelope first and performs one bounded retry with the also-documented direct `schema` field only when Nutrient returns a request-shape error (`400`/`422`). Authentication and other provider failures are not retried.

## Doctavian

Doctavian's hackathon demo requests require **both**:

- `DOCTAVIAN_API_KEY` sent as `X-Api-Key`;
- `DOCTAVIAN_ACCESS_TOKEN` sent as an OAuth bearer token.

Run only after both are available:

```bash
npm run smoke:doctavian
```

The smoke performs the same provider sequence as the live application:

1. upload `veriremit-release-template.docx`;
2. upload structured release JSON;
3. call `/v1/documents/document/generate`;
4. download the generated PDF.

Success evidence to record:

- the deterministic DOCX template is accepted;
- structured data drives merge fields, the verification-control repeater, and the control-count calculation;
- the generated artifact downloads as a real PDF;
- no API key, bearer token, storage URN, or generated provider identifier is printed or committed.

The full VeriRemit flow must then prove that this generation occurs only after the deterministic + human release gate, and that the Doctavian-generated PDF is the primary document handed to Foxit MCP.

## Foxit PDF Services MCP

Run only with the unified Foxit developer credentials supplied through the environment:

```bash
npm run smoke:foxit:mcp
```

Success evidence to record after execution:

- the project-installed official Foxit stdio MCP server connects;
- the exposed VeriRemit allow-list contains only `upload_document`, `pdf_from_html`, `pdf_merge`, and `download_document`;
- no signing/eSign capability is available through the MCP boundary;
- the standalone smoke completes a reversible PDF operation successfully.

The final end-to-end demo must additionally show Foxit MCP uploading the Doctavian-generated authorization PDF, uploading the supporting evidence PDFs, merging them, and downloading the final release packet. Signing remains outside MCP.

## Foxit eSign

Set an explicit human signer and smoke PDF, then run:

```bash
npm run smoke:foxit:esign
```

Required environment inputs in addition to Foxit credentials:

- `VERIREMIT_SIGNER_EMAIL` - the human who will actually sign the developer-test envelope;
- `FOXIT_ESIGN_SMOKE_PDF` - an explicit local synthetic PDF path.

Success evidence to record after execution:

- a real eSign envelope is created through the direct eSign API, not MCP;
- the human completes the signature;
- final completion is confirmed from Foxit's authoritative envelope-details API;
- embedded signing tokens/URLs are never committed or printed in the verification record.

## Final end-to-end live sequence

After individual smokes pass:

```bash
npm run demo:reset
node --env-file-if-exists=.env.local --experimental-strip-types apps/agent/src/main.ts
npm run dev --workspace @veriremit/web
```

The recording must show the real provider chain in order:

```text
plain-language reviewer
-> Nutrient grounded extraction / Viewer
-> deterministic bank-account block
-> human trusted callback
-> Doctavian structured generation
-> Foxit MCP packet assembly
-> Foxit direct eSign envelope
-> human signature
-> authoritative Foxit completion
-> verified hash chain
```

## Credential-blocked behavior

The smoke runners and live-runtime configuration fail closed when required credentials are absent. Missing configuration errors name only environment variables; provider credentials are not printed. `npm run check:secrets` also scans tracked source for OpenAI, GitHub, Cloudflare, Groq and Doctavian high-risk credential patterns.
