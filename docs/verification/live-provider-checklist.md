# Live Provider Verification Checklist

Verification date: 2026-09-02

This checklist separates implemented provider adapters from live sponsor verification. A provider integration is considered live-verified only after the corresponding command or authoritative provider lookup succeeds with environment-provided credentials. No secret values, raw session tokens, signing URLs, OAuth tokens, or full provider identifiers are recorded here.

## Current status

| Provider | Required live proof | Status | Evidence / remaining blocker |
| --- | --- | --- | --- |
| Groq bounded reviewer | Execute the real four-tool reviewer with `openai/gpt-oss-120b` through Groq's OpenAI-compatible endpoint | **PASS** | Isolated live smoke succeeded against the real Groq-backed reviewer; model output and credential were intentionally not printed |
| Nutrient Data Extraction | Extract the synthetic vendor-master PDF and return grounded `iban` and `trusted_phone` facts with page coordinates/confidence | **PASS** | Final live smoke extracted 5 grounded fields from the synthetic source packet |
| Nutrient DWS Viewer | Upload the same synthetic document and create a short-lived read-only viewer session | **PASS** | Final live smoke completed the DWS upload and created the scoped read-only Viewer session; document/session identifiers were intentionally not printed |
| Doctavian | Upload the deterministic DOCX template + structured release JSON, generate a PDF, and download it | **PENDING LIVE RETEST** | Authentication and both multipart uploads are live-proven (`user/get` 200, template 201, data 201). The latest generation call returned 500 `TEMPLATE_READ_FAILED`; the template package and documented repeater syntax have been corrected locally and now require a fresh live generation/download retest |
| Foxit PDF Services via official MCP | Connect to the stdio MCP server, keep signing outside MCP, and complete a reversible real PDF operation | **PASS** | Live smoke connected to the real Foxit MCP and completed a real HTML-to-PDF conversion/download; the project-level static agent allow-list remains `upload_document`, `pdf_from_html`, `pdf_merge`, `download_document` |
| Foxit eSign direct API | Create a real envelope for the configured human signer, complete the signature, and verify authoritative completion through the API | **PASS** | Real developer-test envelope was created and signed; Foxit's authoritative lookup returned `EXECUTED` and activity history confirmed a signer action |
| Real human Foxit signature | Human signer completes the provider-hosted signing step | **PASS** | Authoritative Foxit status verification confirmed the full human-signature round trip, not merely a browser success page |

## Safety rule

If a live check fails because the provider contract, credential scope, account authorization, quota, or runtime is incompatible, remove or narrow that provider/sponsor claim. Do not substitute fixture behavior and call it live verification.

## Groq bounded reviewer - PASS

The production reviewer uses the OpenAI Agents SDK with a Groq-backed `OpenAIProvider` when `GROQ_API_KEY` is present. The model is `openai/gpt-oss-120b`; the run is capped at three turns; the tool surface is restricted to:

- `get_case_summary`;
- `extract_case`;
- `prepare_release`;
- `request_human_signature`.

Live command:

```bash
npm run smoke:groq
```

Verified on 2026-09-01: the real Groq-backed reviewer completed the bounded live smoke successfully. The smoke requires exactly one safe `get_case_summary` call; the other consequential tools fail closed during this proof. Model output and credentials are not printed.

## Nutrient - PASS

Live command:

```bash
npm run smoke:nutrient
```

Verified on 2026-09-01:

- live extraction succeeded against `fixtures/acme-components/vendor-master.pdf`;
- 5 grounded fields were returned, including the bank/contact evidence needed by VeriRemit;
- extraction metadata contains page references, bounding boxes, and confidence;
- DWS upload succeeded;
- a short-lived read-only Viewer session was created;
- no document ID or Viewer session token was printed or committed.

Live contract probing also showed that Nutrient rejects unsupported JSON Schema keywords such as `additionalProperties`. VeriRemit was narrowed to the live-proven `instructions: { schema }` envelope and a provider-compatible schema subset rather than preserving a speculative fallback.

## Doctavian - AUTH AND UPLOADS VERIFIED; PENDING LIVE RETEST

Doctavian's generation flow requires the same two credentials implemented by VeriRemit:

- `DOCTAVIAN_API_KEY` sent as `X-Api-Key`;
- `DOCTAVIAN_ACCESS_TOKEN` sent as an OAuth bearer token.

On 2026-09-02 the supplied Postman collection used a fresh Microsoft OAuth token and reached the document-generation boundary with both required credentials. The canonical sanitized result was:

```text
GET  /v1/common/user/get                    200
POST /v1/documents/template/upload         201
POST /v1/documents/data/upload             201
POST /v1/documents/document/generate       500 TEMPLATE_READ_FAILED
GET  /v1/documents/document/{urn}/download not reached
```

This proves that OAuth, the API key, caller/account linkage, template upload, and JSON file upload were accepted. It does not prove document generation. The bounded provider error was `Failed to read the template`; no credential or provider identifier is recorded here.

The failed template used a hand-built, dependency-free ZIP containing only `[Content_Types].xml`, `_rels/.rels`, and `word/document.xml`. Local comparison found 24 package parts in Doctavian's official Mission 1 DOCX and 22 in a document emitted by the maintained `docx` library. The official Mission 1 template also proves the current repeater form: `value="{!...}"`, repeated values as `{!#variable#.Field}`, `mode="standard"`, and a named closing tag. VeriRemit now uses pinned `docx@9.7.1`, retains all release fields and `{!$count(Release.Checks)}`, and passes structural/compatibility tests through an independent ZIP parser. These are local compatibility facts only, not live Doctavian proof.

Doctavian is **not** promoted to PASS yet. The remaining proof is a single clean retest of the real document path with a fresh bearer token:

```bash
npm run smoke:doctavian
```

The canonical Postman-ready inputs generated from the same ACME data shape used by the smoke are:

- `artifacts/doctavian/veriremit-release-template.docx`;
- `artifacts/doctavian/veriremit-release-data.json`.

The live flow must perform the same provider sequence as the application:

1. multipart upload `veriremit-release-template.docx` to `/v1/documents/template/upload`;
2. multipart upload the structured release JSON file to `/v1/documents/data/upload`;
3. call `/v1/documents/document/generate` with the returned template/data IDs;
4. download `/v1/documents/document/{urn}/download` and verify that the returned bytes are a real PDF.

Success evidence still required before promoting Doctavian to PASS:

- `/v1/common/user/get` returns 200 with the fresh current token;
- template upload returns 201 and the template ID is captured;
- canonical structured JSON is uploaded as multipart file bytes under field `file`, returns 201, and its data ID is captured;
- generation with those two IDs returns 201 and a document URN;
- download returns 200 and the response is a non-empty file beginning with `%PDF-`;
- the PDF content contains the expected ACME Components / VeriRemit values, repeater rows, and control count;
- no API key, bearer token, storage URN, or generated provider identifier is committed or printed in public verification records.

## Foxit PDF Services MCP - PASS

Live command:

```bash
npm run smoke:foxit:mcp
```

Verified on 2026-09-01:

- the project-installed official Foxit stdio MCP server connected to the real service;
- the live server tool catalog contained no signing/eSign capability;
- VeriRemit's agent boundary statically allows only `upload_document`, `pdf_from_html`, `pdf_merge`, and `download_document`;
- a real HTML document was uploaded, converted to PDF, downloaded, and validated as a PDF successfully.

The final end-to-end demo should additionally show the intended composition path: Foxit MCP receives the Doctavian-generated authorization PDF plus supporting evidence, merges them, and downloads the release packet. Signing remains outside MCP.

## Foxit eSign - PASS

The direct eSign path has completed the sponsor-required human round trip with a real developer-test envelope.

Verified on 2026-09-01:

- a real envelope was created through the direct Foxit eSign API, not MCP;
- the human signer completed the signing action in Foxit;
- a fresh authoritative provider lookup reported envelope status `EXECUTED`;
- Foxit activity history independently recorded a signer action;
- the verification job succeeded only when both authoritative completion and signer activity were present;
- signing-session URLs, envelope identifiers, and credentials were not committed or printed in the public verification record.

## Final end-to-end live sequence

After Doctavian is promoted to PASS, reset the demo and run the recording flow:

```bash
npm run demo:reset
node --env-file-if-exists=.env.local --experimental-strip-types apps/agent/src/main.ts
npm run dev --workspace @veriremit/web
```

The recording should show the real provider chain in order:

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

The smoke runners and live-runtime configuration fail closed when required credentials are absent, expired, or rejected. Missing configuration errors name only environment variables; provider credentials are not printed. `npm run check:secrets` also scans tracked source for high-risk credential patterns.
