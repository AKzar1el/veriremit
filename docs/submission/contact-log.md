# Sponsor Access Contact Log

Last updated: 2026-09-02

This file records only non-secret sponsor access actions relevant to submission readiness. It intentionally excludes message IDs, credentials, tokens, signing links, envelope identifiers, and provider account identifiers.

| Sponsor | Verified contact / route | Action | Status |
| --- | --- | --- | --- |
| Nutrient | Hackathon access path + DWS developer credentials | Obtained credentials, validated the live extraction contract, then ran the final extraction + Viewer smoke against the synthetic packet | **COMPLETE - live extraction and scoped read-only Viewer session verified** |
| Foxit | Foxit developer access + direct eSign developer account | Obtained developer credentials, fixed the MCP file-path contract, verified a reversible live MCP operation, created a real eSign envelope, completed the human signature, and queried authoritative provider state | **COMPLETE - MCP verified; eSign envelope reached `EXECUTED`; signer action confirmed in activity history** |
| Doctavian | `hello@doctavian.com` / Kanwal Roshi support thread | Provisioned API key + Microsoft OAuth authenticated; official Mission 1 control flow isolated template compatibility; provider-native VeriRemit template then completed generation and download | **COMPLETE - user preflight 200, uploads 201/201, generation 201, download 200, generated PDF content validated** |

## Doctavian handoff

Doctavian support confirmed the intended authentication path: use both the provisioned API key and a Microsoft OAuth bearer token from the supplied Postman collection. That path is live-proven.

The final canonical VeriRemit attempt reached:

1. `GET /v1/common/user/get` -> 200;
2. `POST /v1/documents/template/upload` -> 201;
3. `POST /v1/documents/data/upload` -> 201;
4. `POST /v1/documents/document/generate` -> 201;
5. `GET /v1/documents/document/{urn}/download` -> 200;
6. the downloaded Payment Release Authorization was opened and its canonical VeriRemit/ACME data and two verification controls were validated.

The debugging control was also useful: generic DOCX packages were accepted at upload but rejected by the template reader, while Doctavian's official Mission 1 DOCX generated successfully. The successful VeriRemit template preserved that provider-native Maven Word package structure. No further sponsor-side account action is currently required.

Before the final recording, rerun the exact checked-in runtime once with a fresh OAuth bearer to catch short-lived credential/session drift.

No credential value should be pasted into this file, committed to GitHub, or exposed in the browser UI.

## Foxit address note

The Devpost Foxit challenge currently displays a contact address ending in `.come`. That malformed public address is preserved here only as an external-source caveat; VeriRemit did not rely on guessing or silently correcting it for credential handling.
