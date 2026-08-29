# Submission Readiness Status

Last updated: 2026-08-29

| Gate | Status | Evidence / blocker |
| --- | --- | --- |
| Core deterministic workflow | PASS | Clean GitHub Actions run: 113/113 tests passing; core/provider/app typechecks, Vite build, and secret scan passing |
| Prompt-first agent boundary | PASS | Case-scoped route + bounded tools + UI tests |
| Synthetic PDF packet | PASS | Deterministic generation + text/visual QA |
| Nutrient adapter contract | PASS | Official-response contract tests |
| Foxit MCP adapter contract | PASS | Official-tool contract tests |
| Foxit eSign adapter contract | PASS | Direct API contract tests |
| Production dependency audit | PASS | Clean GitHub runner: `npm audit --omit=dev --audit-level=high` reports 0 vulnerabilities |
| Dependency lock / reproducible install | PASS | Committed `package-lock.json`; clean CI and agent container both install with `npm ci` |
| Browser Playwright execution | PASS | Chromium CI: 2/2 golden-path tests pass on the first attempt with retries disabled |
| Agent container packaging | PASS | `Dockerfile.agent` builds on Ubuntu CI, starts in fixture mode, and returns HTTP 200 from `/health` |
| Live Nutrient extraction | BLOCKED | Sponsor API credential not configured in a runnable live environment |
| Live Nutrient DWS Viewer | BLOCKED | Sponsor Viewer credential not configured in a runnable live environment |
| Live Foxit MCP | BLOCKED | Foxit developer credentials not configured in a runnable live environment |
| Live Foxit eSign + human signature | BLOCKED | Foxit credentials, signer, and real human completion still required |
| Public GitHub repository | PASS | Hardened source, tests, fixtures, setup docs, sponsor verification docs, lockfile, and green CI are published on `main` |
| Hosted live deployment | OPTIONAL / NOT VERIFIED | Current sponsor submission criteria do not require a public hosted URL; if a live agent is hosted, it must be private/authenticated and then separately smoke-tested |
| Public live API access control | BLOCKED FOR PUBLIC HOSTING | CORS is configured but authentication is intentionally external; keep live API private/local or protect it with an authenticated access proxy |
| 2-4 minute sponsor video | READY AFTER LIVE GATES | Exact script and recording checklist are prepared; record only after Nutrient/Foxit live checks pass and the human completes the Foxit signature |

The remaining submission blockers are external evidence, not offline implementation quality: activate/configure the free sponsor developer credentials, run the live Nutrient/Foxit smoke checks, complete the real human Foxit signature, then record and submit the 2-4 minute demo.

A `BLOCKED` row is not a failed feature claim. It means the implementation exists but the required external evidence has not yet been produced. Sponsor copy must stay gated until the corresponding live check passes.
