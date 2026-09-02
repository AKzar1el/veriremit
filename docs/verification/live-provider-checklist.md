# Live Provider Verification Checklist

Last verified: **September 2, 2026**

This checklist records real sponsor-path evidence separately from fixture-mode and local-only validation. A provider is marked **PASS** only when a real remote call completed and the expected boundary/result was observed.

## Groq

**Status: PASS**

- real provider mode selected;
- bounded reviewer invoked through Groq;
- `reviewer.modelInvoked = true` persisted;
- deterministic release controls remained authoritative;
- the model did not authorize payment or signature.

## Nutrient

**Status: PASS**

### Data Extraction

- real extraction session created;
- extraction completed;
- source filename/page grounding preserved;
- extracted facts flowed into deterministic reconciliation.

### DWS Viewer

- source document uploaded;
- viewer session created;
- evidence could be opened from the review flow;
- no fixture-only claim is used for the submission.

## Doctavian

**Status: PASS**

Live VeriRemit sequence:

1. `GET /v1/common/user/get` -> **200**
2. `POST /v1/documents/template/upload` -> **201**
3. `POST /v1/documents/data/upload` -> **201**
4. `POST /v1/documents/document/generate` -> **201**
5. `GET /v1/documents/document/{urn}/download` -> **200**
6. downloaded bytes validated as a non-empty PDF and the rendered content was inspected.

Validated output content included:

- `VERIREMIT`
- `ACME Components GmbH`
- `case_acme_po_4821`
- `PO-4821`
- `bank_account_continuity — PASS`
- `human_verification — PASS`
- `CONTROL COUNT: 2`
- reviewer `Tomi Seregi`
- verification reference `VR-LIVE-4821`
- expected amount, beneficiary, and verified IBAN
- the explicit statement that the document records approval evidence and does not execute payment.

### Template compatibility finding

Doctavian accepted multiple generic DOCX files at the upload endpoint but returned `TEMPLATE_READ_FAILED` when generation attempted to parse them. The official Doctavian Mission 1 template generated successfully under the same account/API path. VeriRemit's successful template was therefore derived from that known-good provider-native package and preserved the Maven Word web-extension/package structure, including the Maven add-in reference, while replacing the business content with VeriRemit merge/repeater fields.

The repo now regression-tests the provider-native package parts and the canonical Doctavian data envelope. Before the final recorded demo, rerun `npm run smoke:doctavian` with a fresh OAuth bearer so the exact checked-in runtime path is freshly proven end to end.

## Foxit PDF Services MCP

**Status: PASS**

- official Foxit PDF Services MCP server used;
- real upload completed;
- real merge completed;
- merged PDF downloaded;
- allow-list remains limited to reversible packet preparation operations;
- no signing tool is exposed through the MCP boundary.

## Foxit eSign

**Status: PASS**

### Envelope/session

- real envelope created through the direct eSign API;
- embedded human signing session created;
- browser signing flow opened successfully.

### Human completion

- a real human signer completed the envelope;
- Foxit's authoritative status reached **`EXECUTED`**;
- Foxit activity history recorded the signer action;
- the app does not treat a browser success redirect as authoritative completion.

## Overall sponsor verification

| Path | Result |
| --- | --- |
| Groq reviewer | **PASS** |
| Nutrient extraction | **PASS** |
| Nutrient viewer | **PASS** |
| Doctavian generation/download | **PASS** |
| Foxit PDF Services MCP | **PASS** |
| Foxit eSign envelope/session | **PASS** |
| Foxit human signature round trip | **PASS** |

**Remaining verification task:** one fresh canonical end-to-end run from the exact submitted code immediately before recording, primarily to catch credential expiry or provider-session drift. This is a recording/readiness check, not an unresolved sponsor integration bug.
