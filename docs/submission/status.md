# Submission Readiness Status

Last updated: 2026-09-01

| Gate | Status | Evidence / blocker |
| --- | --- | --- |
| Core deterministic workflow | PASS | Clean GitHub Actions run: 123/123 tests passing; core/provider/app typechecks, Vite build, and secret scan passing |
| Prompt-first bounded reviewer | PASS | OpenAI Agents SDK with four case-scoped tools; Groq `openai/gpt-oss-120b` provider contract covered; OpenAI fallback preserved |
| Synthetic PDF packet | PASS | Deterministic generation + text/visual QA |
| Nutrient adapter contract | PASS | Grounded response mapping plus bounded compatibility for the two currently documented extraction request envelopes |
| Nutrient DWS Viewer adapter | PASS | Backend document upload + short-lived scoped session contract tests |
| Doctavian generation adapter | PASS | Bearer + `X-Api-Key` authentication, template/data upload, generation, download, credential-safe errors |
| Doctavian template | PASS | Deterministic dependency-free DOCX with merge fields, structured repeater, and control-count calculation |
| Doctavian -> Foxit composition | PASS | Server gate passes structured approved case data to Doctavian before Foxit assembly; audit ordering covered |
| Foxit MCP adapter contract | PASS | Official-tool contract tests, static reversible allow-list, generated-PDF packet path |
| Foxit eSign adapter contract | PASS | Direct API contract tests; signing is outside MCP |
| Tamper-evident audit coverage | PASS | Doctavian generation, Foxit MCP completion, release preparation, eSign creation, and final signature state are hash-chained |
| Production dependency audit | PASS | Clean GitHub runner: `npm audit --omit=dev --audit-level=high` reports 0 vulnerabilities |
| Dependency lock / reproducible install | PASS | Committed `package-lock.json`; clean CI and agent container both install with `npm ci` |
| Browser Playwright execution | PASS | Chromium CI: 2/2 golden-path tests pass on the first attempt with retries disabled |
| Agent container packaging | PASS | `Dockerfile.agent` builds on Ubuntu CI, starts in fixture mode, and returns HTTP 200 from `/health` |
| Live Groq bounded reviewer | NOT VERIFIED | Credential exists outside the repository but has not been injected into a runnable live smoke environment |
| Live Nutrient extraction | NOT VERIFIED | Sponsor credential exists outside the repository; credential-gated smoke has not yet been executed in a safe runtime |
| Live Nutrient DWS Viewer | NOT VERIFIED | Viewer backend credential exists outside the repository; credential-gated smoke has not yet been executed in a safe runtime |
| Live Doctavian generation | BLOCKED | Hackathon API key is provisioned, but the required OAuth bearer token has not yet been obtained; provider support has been contacted |
| Live Foxit MCP | NOT VERIFIED | Developer credentials exist outside the repository; credential-gated smoke has not yet been executed in a safe runtime |
| Live Foxit eSign envelope | NOT VERIFIED | Developer credentials and signer are known, but no real envelope has yet been created for the submission flow |
| Real human Foxit signature | BLOCKED | Must be completed by the human signer after the live eSign envelope is created |
| Public GitHub repository | PASS | Hardened source, tests, fixtures, setup docs, sponsor verification docs, lockfile, and green CI are published on `main` |
| Devpost project metadata | PASS | Project name, tagline, technical write-up, stack, and GitHub link are populated without claiming unverified live calls |
| Sponsor-prize opt-ins | PENDING | Foxit, Nutrient and Doctavian tracks must be selected on the hackathon submission before final submit |
| Hosted live deployment | OPTIONAL / NOT VERIFIED | Sponsor submission criteria require a working demo video, repo and setup—not a public agent URL; any hosted live API must be authenticated |
| Public live API access control | BLOCKED FOR PUBLIC HOSTING | CORS is configured but authentication is intentionally external; keep live API private/local or protect it with an authenticated access proxy |
| 2-4 minute sponsor video | BLOCKED | Record only after live Nutrient/Doctavian/Foxit proof and the real human Foxit signature succeed |
| Downloadable MP4 backup | BLOCKED | Devpost requires a downloadable backup video link in addition to the public demo-video URL |
| Final Devpost submit | BLOCKED | Submission remains unsubmitted until live proof, video, backup MP4 and sponsor opt-ins are complete |

The remaining implementation risk is now concentrated in external evidence rather than offline code quality. The critical path is: obtain the supported Doctavian OAuth bearer token, execute the credential-gated live smokes in a safe runtime, complete the real Foxit human signature, record the 2-4 minute end-to-end demo, upload a downloadable MP4 backup, select the three sponsor prizes, and final-submit before the deadline.

A `NOT VERIFIED` or `BLOCKED` row is not a failed feature claim. It means the implementation exists but the required external evidence has not yet been produced. Sponsor copy must stay gated until the corresponding live check passes.
