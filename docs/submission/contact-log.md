# Sponsor Access Contact Log

Last updated: 2026-09-02

This file records only non-secret sponsor access actions relevant to submission readiness. It intentionally excludes message IDs, credentials, tokens, signing links, envelope identifiers, and provider account identifiers.

| Sponsor | Verified contact / route | Action | Status |
| --- | --- | --- | --- |
| Nutrient | Hackathon access path + DWS developer credentials | Obtained credentials, validated the live extraction contract, then ran the final extraction + Viewer smoke against the synthetic packet | **COMPLETE - live extraction and scoped read-only Viewer session verified** |
| Foxit | Foxit developer access + direct eSign developer account | Obtained developer credentials, fixed the MCP file-path contract, verified a reversible live MCP operation, created a real eSign envelope, completed the human signature, and queried authoritative provider state | **COMPLETE - MCP verified; eSign envelope reached `EXECUTED`; signer action confirmed in activity history** |
| Doctavian | `hello@doctavian.com` / Kanwal Roshi support thread | Provisioned API key and Microsoft OAuth now authenticate; latest canonical run reached template processing after both multipart uploads succeeded | **PENDING LIVE RETEST - generation returned 500 `TEMPLATE_READ_FAILED`; corrected DOCX package must complete generation/download** |

## Doctavian handoff

Doctavian support previously confirmed the intended authentication path: use both the provisioned API key and a Microsoft OAuth bearer token from the supplied Postman collection. That path is now live-proven.

The latest canonical credential-safe attempt reached:

1. `GET /v1/common/user/get` -> 200;
2. `POST /v1/documents/template/upload` -> 201;
3. `POST /v1/documents/data/upload` -> 201;
4. `POST /v1/documents/document/generate` -> 500 `TEMPLATE_READ_FAILED`;
5. download was not reached.

This supersedes the earlier authorization evidence: authentication and both uploads are working. The former hand-built DOCX package and repeater syntax have been replaced based on Doctavian's official Mission 1 sample and a maintained DOCX generator. The next action is a fresh-token live retest using the canonical files under `artifacts/doctavian/`.

Promote Doctavian to PASS only if template upload, structured data upload, PDF generation, and download all succeed.

No credential value should be pasted into this file, committed to GitHub, or exposed in the browser UI.

## Foxit address note

The Devpost Foxit challenge currently displays a contact address ending in `.come`. That malformed public address is preserved here only as an external-source caveat; VeriRemit did not rely on guessing or silently correcting it for credential handling.
