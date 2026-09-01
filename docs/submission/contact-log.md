# Sponsor Access Contact Log

Last updated: 2026-09-01

This file records only non-secret sponsor access actions relevant to submission readiness. It intentionally excludes message IDs, credentials, tokens, signing links, envelope identifiers, and provider account identifiers.

| Sponsor | Verified contact / route | Action | Status |
| --- | --- | --- | --- |
| Nutrient | Hackathon access path + DWS developer credentials | Obtained credentials, validated the live extraction contract, then ran the final extraction + Viewer smoke against the synthetic packet | **COMPLETE - live extraction and scoped read-only Viewer session verified** |
| Foxit | Foxit developer access + direct eSign developer account | Obtained developer credentials, fixed the MCP file-path contract, verified a reversible live MCP operation, created a real eSign envelope, completed the human signature, and queried authoritative provider state | **COMPLETE - MCP verified; eSign envelope reached `EXECUTED`; signer action confirmed in activity history** |
| Doctavian | `hello@doctavian.com` / Kanwal Roshi support thread | Provisioned hackathon API key obtained; Microsoft OAuth flow successfully issued an API-scoped bearer token; clean server-side probes then reproduced `401 AUTHORIZATION_ERROR` on caller-profile/membership, limits, and template-upload endpoints | **BLOCKED - sponsor-side caller/team authorization or missing demo caller context must be clarified** |

## Doctavian handoff

Doctavian support previously confirmed the intended authentication path: use both the provisioned API key and a Microsoft OAuth bearer token from the supplied Postman collection. That OAuth acquisition step has now been completed successfully.

The remaining blocker was isolated with credential-safe live probes:

1. the Microsoft Authorization Code + PKCE flow issued an access token with the expected API scope;
2. a one-run clean server-side runner received the token/API key only through an ephemeral encrypted handoff;
3. `GET /v1/common/limits/get` returned `401 AUTHORIZATION_ERROR` with bearer only, API key only, and bearer + API key;
4. `GET /v1/common/user/get`, described by the sponsor collection as returning caller profile and membership details, returned the same `401 AUTHORIZATION_ERROR` using inherited OAuth semantics;
5. `POST /v1/documents/template/upload` returned the same authorization failure before document processing; adding `X-Storage-Type` did not change the result;
6. decrypted credentials and the temporary verification workflow/input were removed after the probes.

The next support action is therefore to have Doctavian confirm that the Microsoft identity used for OAuth is actually authorized/mapped to the provisioned Team Tomi demo account, or tell us what additional demo-environment caller context is required. After that correction, obtain a fresh token if necessary and rerun `npm run smoke:doctavian`.

Promote Doctavian to PASS only if template upload, structured data upload, PDF generation, and download all succeed.

No credential value should be pasted into this file, committed to GitHub, or exposed in the browser UI.

## Foxit address note

The Devpost Foxit challenge currently displays a contact address ending in `.come`. That malformed public address is preserved here only as an external-source caveat; VeriRemit did not rely on guessing or silently correcting it for credential handling.
