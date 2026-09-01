# Live Provider Verification Checklist

Verification date: 2026-09-01

This checklist separates implemented provider adapters from live sponsor verification. A provider integration is considered live-verified only after the corresponding command or authoritative provider lookup succeeds with environment-provided credentials. No secret values, raw session tokens, signing URLs, OAuth tokens, or full provider identifiers are recorded here.

## Current status

| Provider | Required live proof | Status | Evidence / remaining blocker |
| --- | --- | --- | --- |
| Groq bounded reviewer | Execute the real four-tool reviewer with `openai/gpt-oss-120b` through Groq's OpenAI-compatible endpoint | **PASS** | Isolated live smoke succeeded against the real Groq-backed reviewer; model output and credential were intentionally not printed |
| Nutrient Data Extraction | Extract the synthetic vendor-master PDF and return grounded `iban` and `trusted_phone` facts with page coordinates/confidence | **PASS** | Final live smoke extracted 5 grounded fields from the synthetic source packet |
| Nutrient DWS Viewer | Upload the same synthetic document and create a short-lived read-only viewer session | **PASS** | Final live smoke completed the DWS upload and created the scoped read-only Viewer session; document/session identifiers were intentionally not printed |
| Doctavian | Upload the deterministic DOCX template + structured release JSON, generate a PDF, and download it | **BLOCKED** | Hackathon API key is provisioned, but the required Microsoft OAuth bearer token has not yet been obtained through the supplied Postman collection |
| Foxit PDF Services via official MCP | Connect to the stdio MCP server, keep signing outside MCP, and complete a reversible real PDF operation | **PASS** | Live smoke connected to the real Foxit MCP and completed a real HTML-to-PDF conversion/download; the project-level static agent allow-list remains `upload_document`, `pdf_from_html`, `pdf_merge`, `download_document` |
| Foxit eSign direct API | Create a real envelope for the configured human signer, complete the signature, and verify authoritative completion through the API | **PASS** | Real developer-test envelope was created and signed; Foxit's authoritative lookup returned `EXECUTED` and activity history confirmed a signer action |
| Real human Foxit signature | Human signer completes the provider-hosted signing step | **PASS** | Authoritative Foxit status verification confirmed the full human-signature round trip, not merely a browser success page |

## Safety rule

If a live check fails because the provider contract, credential scope, quota, or runtime is incompatible, remove or narrow that provider/sponsor claim. Do not substitute fixture behavior and call it live verification.

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

## Doctavian - BLOCKED ON OAUTH TOKEN

Doctavian's hackathon demo requests require **both**:

- `DOCTAVIAN_API_KEY` sent as `X-Api-Key`;
- `DOCTAVIAN_ACCESS_TOKEN` sent as an OAuth bearer token.

The provisioned API key is available outside the repository. Doctavian support confirmed that the intended hackathon path is to use the supplied Postman collection's inherited OAuth 2.0 authorization and complete the Microsoft login flow to generate the bearer token.

After that bearer exists, run:

```bash
npm run smoke:doctavian
```

The smoke performs the same provider sequence as the live application:

1. upload `veriremit-release-template.docx`;
2. upload structured release JSON;
3. call `/v1/documents/document/generate`;
4. download the generated PDF.

Success evidence still required before promoting Doctavian to PASS:

- the deterministic DOCX template is accepted;
- structured data drives merge fields, the verification-control repeater, and the control-count calculation;
- the generated artifact downloads as a real PDF;
- no API key, bearer token, storage URN, or generated provider identifier is printed or committed.

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

The smoke runners and live-runtime configuration fail closed when required credentials are absent. Missing configuration errors name only environment variables; provider credentials are not printed. `npm run check:secrets` also scans tracked source for high-risk credential patterns.
