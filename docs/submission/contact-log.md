# Sponsor Access Contact Log

Last updated: 2026-09-01

This file records only non-secret sponsor access actions relevant to submission readiness. It intentionally excludes message IDs, credentials, tokens, signing links, envelope identifiers, and provider account identifiers.

| Sponsor | Verified contact / route | Action | Status |
| --- | --- | --- | --- |
| Nutrient | Hackathon access path + DWS developer credentials | Obtained credentials, validated the live extraction contract, then ran the final extraction + Viewer smoke against the synthetic packet | **COMPLETE - live extraction and scoped read-only Viewer session verified** |
| Foxit | Foxit developer access + direct eSign developer account | Obtained developer credentials, fixed the MCP file-path contract, verified a reversible live MCP operation, created a real eSign envelope, completed the human signature, and queried authoritative provider state | **COMPLETE - MCP verified; eSign envelope reached `EXECUTED`; signer action confirmed in activity history** |
| Doctavian | `hello@doctavian.com` / Kanwal Roshi support thread | Provisioned hackathon API key obtained. Support confirmed that hackathon requests require both the API key and a Microsoft OAuth bearer token generated through the supplied Postman collection's inherited OAuth 2.0 flow | **BLOCKED - interactive Microsoft OAuth bearer still required** |

## Doctavian handoff

Doctavian support confirmed the intended authentication path rather than a custom application-side workaround:

1. open the supplied Doctavian Postman collection;
2. use the collection's inherited OAuth 2.0 authorization;
3. complete the Microsoft login flow and generate the access token;
4. keep the bearer token local as `DOCTAVIAN_ACCESS_TOKEN` and keep the provisioned API key local as `DOCTAVIAN_API_KEY`;
5. run `npm run smoke:doctavian`;
6. promote Doctavian to PASS only if template upload, structured data upload, PDF generation, and download all succeed.

No credential value should be pasted into this file, committed to GitHub, or exposed in the browser UI.

## Foxit address note

The Devpost Foxit challenge currently displays a contact address ending in `.come`. That malformed public address is preserved here only as an external-source caveat; VeriRemit did not rely on guessing or silently correcting it for credential handling.
