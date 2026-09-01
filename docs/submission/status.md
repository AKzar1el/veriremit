# Submission Readiness Status

Last updated: 2026-09-01

| Gate | Status | Evidence / blocker |
| --- | --- | --- |
| Core deterministic workflow | PASS | Clean GitHub Actions baseline: 123/123 tests passing; core/provider/app typechecks, Vite build, and secret scan passing |
| Prompt-first bounded reviewer | PASS | OpenAI Agents SDK with four case-scoped tools; Groq `openai/gpt-oss-120b` provider contract covered; OpenAI fallback preserved |
| Synthetic PDF packet | PASS | Deterministic generation + text/visual QA |
| Nutrient adapter contract | PASS | Grounded response mapping narrowed to the live-proven extraction request/schema contract |
| Nutrient DWS Viewer adapter | PASS | Backend document upload + short-lived scoped session contract tests |
| Doctavian generation adapter | PASS | Bearer + `X-Api-Key` authentication, multipart template/data upload, generation, download, credential-safe errors |
| Doctavian template | PASS | Deterministic dependency-free DOCX with merge fields, structured repeater, and control-count calculation |
| Doctavian -> Foxit composition | PASS | Server gate passes structured approved case data to Doctavian before Foxit assembly; audit ordering covered |
| Foxit MCP adapter contract | PASS | Official-tool contract tests and project-level static reversible allow-list |
| Foxit eSign adapter contract | PASS | Direct API contract tests; signing remains outside MCP |
| Tamper-evident audit coverage | PASS | Doctavian generation, Foxit MCP completion, release preparation, eSign creation, and final signature state are hash-chained |
| Production dependency audit | PASS | Clean GitHub runner: `npm audit --omit=dev --audit-level=high` reports 0 vulnerabilities |
| Dependency lock / reproducible install | PASS | Committed `package-lock.json`; clean CI and agent container both install with `npm ci` |
| Browser Playwright execution | PASS | Chromium CI: 2/2 golden-path tests pass on the first attempt with retries disabled |
| Agent container packaging | PASS | `Dockerfile.agent` builds on Ubuntu CI, starts in fixture mode, and returns HTTP 200 from `/health` |
| Live Groq bounded reviewer | **PASS** | Real Groq-backed bounded reviewer smoke succeeded; model output/credential were intentionally not printed |
| Live Nutrient extraction | **PASS** | Real extraction succeeded with 5 grounded fields from the synthetic vendor-master document |
| Live Nutrient DWS Viewer | **PASS** | Real DWS upload and scoped read-only Viewer session succeeded; provider identifiers/tokens were intentionally not printed |
| Doctavian caller/account authorization | **PASS** | Microsoft OAuth succeeds and `/v1/common/user/get` now returns 200 for the provisioned active account after the first successful Microsoft portal login |
| Live Doctavian generation | **PENDING CLEAN RUN** | The canonical multipart template upload -> multipart data upload -> generation -> PDF download path still needs one uninterrupted run with a fresh bearer token; expired-token and malformed scratch attempts do not count as proof |
| Live Foxit MCP | **PASS** | Real Foxit stdio MCP connected and completed a reversible HTML-to-PDF conversion/download; signing capability remained outside the agent boundary |
| Live Foxit eSign envelope | **PASS** | A real developer-test envelope was created through the direct eSign API and completed by the human signer |
| Real human Foxit signature | **PASS** | Fresh authoritative Foxit lookup reported `EXECUTED`; activity history independently confirmed a signer action |
| Public GitHub repository | PASS | Hardened source, tests, fixtures, setup docs, sponsor verification docs, lockfile, and green CI are published on `main` |
| Devpost project page | PASS | VeriRemit project page is published and linked to the repository |
| Hackathon submission | **NOT YET SUBMITTED** | Live Devpost record currently has no `submitted_at`; final submission remains intentionally gated on required deliverables |
| Sponsor-prize opt-ins | PENDING | Foxit, Nutrient and Doctavian tracks must be selected when the final hackathon submission is sent |
| Hosted live deployment | OPTIONAL / NOT VERIFIED | Sponsor criteria require a working demo video, repo and setup—not a public agent URL; any hosted live API must be authenticated |
| Public live API access control | BLOCKED FOR PUBLIC HOSTING | CORS is configured but authentication is intentionally external; keep live API private/local or protect it with an authenticated access proxy |
| 2-4 minute sponsor video | **BLOCKED ON DOCTAVIAN GENERATION PROOF** | Groq, Nutrient and Foxit proof now exist; record the canonical sponsor demo only after the real Doctavian generation smoke passes |
| Downloadable MP4 backup | PENDING | Devpost requires a downloadable backup link to the original demo MP4 in addition to the YouTube/Vimeo demo URL |
| Final Devpost submit | **BLOCKED ON REQUIRED DELIVERABLES** | Pass the clean live Doctavian generation smoke, record/upload the demo and MP4 backup, select sponsor tracks, then submit before the deadline |

The prior Doctavian account-authorization hypothesis is resolved. Microsoft OAuth works, the same Microsoft identity can enter the demo portal, and `GET /v1/common/user/get` now returns HTTP 200 for the active provisioned account. The remaining Doctavian risk is therefore much narrower: one clean execution of the actual document-generation chain using the canonical VeriRemit template and structured release JSON.

The latest interactive attempts are **not** sponsor proof. They repeatedly crossed the one-hour bearer expiry boundary, used several malformed/manual multipart constructions, and one scratch script changed the canonical VeriRemit release data while sending `/v1/documents/data/upload` as raw JSON. Doctavian's documented storage workflow requires the template and JSON data to be uploaded as multipart files before generation. Those scratch attempts are discarded rather than being papered over as progress.

The critical path is now:

1. once the local Postman/tool cap clears, generate a fresh Microsoft OAuth token and keep it inside Postman/local execution rather than pasting it into chat or source;
2. run the canonical VeriRemit Doctavian chain immediately and without exploratory edits: multipart template upload -> multipart structured JSON upload -> generation -> PDF download;
3. promote Doctavian only if the returned artifact is a real non-empty PDF whose merge/repeater/calculation content is correct;
4. reset the demo and record the 2-4 minute end-to-end flow;
5. upload the public demo video and a downloadable original-MP4 backup;
6. opt into the Foxit, Nutrient, and Doctavian sponsor prizes;
7. submit the project to the hackathon before the deadline.

A `PENDING` or `BLOCKED` row is not a failed feature claim. It means the implementation exists but the required external evidence or submission deliverable has not yet been produced. Sponsor copy must stay gated until the corresponding live check passes.
