# Submission Status

Last verified: **September 2, 2026**

## Repository / implementation

- Public repository: `https://github.com/AKzar1el/veriremit`
- Canonical demo case: `case_acme_po_4821`
- Doctavian runtime path now uses a tracked provider-native DOCX template package rather than synthesizing a generic DOCX at request time.
- The provider adapter keeps VeriRemit's internal `Release` object provider-neutral and emits Doctavian's live-proven `{ "data": { "Release": [...] } }` envelope only at the provider boundary.
- CI verifies tests, formatting/lint, strict typecheck/build, secret scanning, Playwright E2E, and the production Docker image.

## Live provider verification

| Provider path | Status | Evidence |
| --- | --- | --- |
| Groq bounded reviewer | **PASS** | Real `groq` mode completed the bounded review and persisted `reviewer.modelInvoked = true`; control flow stayed deterministic. |
| Nutrient Data Extraction | **PASS** | Real extraction session completed with source filename/page grounding. |
| Nutrient DWS Viewer | **PASS** | Real document upload + Viewer session path completed. |
| Doctavian document generation | **PASS** | Microsoft OAuth user preflight `200`; template upload `201`; data upload `201`; generation `201`; PDF download `200`; generated VeriRemit PDF content validated. |
| Foxit PDF Services MCP | **PASS** | Real upload -> merge -> download packet assembly completed through the official MCP server. |
| Foxit eSign API | **PASS** | Real envelope creation + embedded signing session completed. |
| Foxit human signature | **PASS** | Real signer completed the envelope; authoritative Foxit status reached `EXECUTED` and activity history recorded the signer action. |

### Doctavian evidence boundary

The successful VeriRemit artifact contains ACME Components GmbH, `case_acme_po_4821`, `PO-4821`, the two required `PASS` controls, `CONTROL COUNT: 2`, reviewer `Tomi Seregi`, verification reference `VR-LIVE-4821`, amount/beneficiary/IBAN details, and the explicit no-payment-execution boundary.

The debugging result was specific: generic programmatically authored DOCX packages were accepted by the upload endpoint but rejected by Doctavian's template reader. Doctavian's own Mission 1 template succeeded, and preserving its provider-native Maven Word package structure produced the successful VeriRemit generation. The public repo therefore tracks that provider-native template lineage and regression-tests the Maven web-extension/package parts instead of claiming a generic DOCX writer is sufficient.

## Recording gate

**No sponsor integration remains blocked.** Before recording the canonical submission video, run one fresh end-to-end live pass from the checked-in runtime with fresh provider credentials, including `npm run smoke:doctavian`, so the recording is anchored to the exact submitted code and not an earlier manual provider test.

## Submission work still required

- record the 2-4 minute canonical end-to-end demo;
- upload the public demo to YouTube or Vimeo;
- upload the original MP4 to a downloadable backup location for the Devpost field;
- paste/final-review the Devpost copy;
- submit before **September 3, 2026 at 10:00 AM PT**.

## Security

- provider secrets remain runtime-only and are not committed;
- OAuth/API tokens and provider object IDs must not appear in the demo recording;
- old debugging bearer tokens are expired and are not part of repository state;
- use synthetic/fictitious payment documents only.
