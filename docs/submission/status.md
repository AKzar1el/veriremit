# Submission Readiness Status

Last updated: 2026-08-29

| Gate | Status | Evidence / blocker |
| --- | --- | --- |
| Core deterministic workflow | PASS | `npm test`: 111 tests passing; core/provider typechecks passing; secret scan and `git diff --check` clean |
| Prompt-first agent boundary | PASS | Case-scoped route + bounded tools + UI tests |
| Synthetic PDF packet | PASS | Deterministic generation + text/visual QA |
| Nutrient adapter contract | PASS | Official-response contract tests |
| Foxit MCP adapter contract | PASS | Official-tool contract tests |
| Foxit eSign adapter contract | PASS | Direct API contract tests |
| Live Nutrient extraction | BLOCKED | Sponsor API credential not configured |
| Live Nutrient DWS Viewer | BLOCKED | Sponsor Viewer credential not configured |
| Live Foxit MCP | BLOCKED | Foxit developer credentials not configured |
| Live Foxit eSign + human signature | BLOCKED | Foxit credentials/signer not configured |
| Public GitHub repository | PASS | Hardened source, tests, fixtures, setup docs, sponsor verification docs, and CI are published on `main`; final CI gates are tracked separately below |
| Hosted live deployment | BLOCKED | No authenticated live deployment with sponsor credentials yet |
| Dependency lock / reproducible install | PASS | Clean GitHub runner generated `package-lock.json`; the committed lock matches the locally verified artifact, and CI/Docker are configured for `npm ci` plus production dependency audit |
| Public live API access control | BLOCKED FOR PUBLIC HOSTING | CORS is configured but authentication is intentionally external; keep live API private/local or protect it with an authenticated access proxy |
| Browser Playwright execution | PENDING FINAL CI | Golden-path Playwright specs are published; the final networked run will execute Chromium after locked install/typecheck/build |
| 2-4 minute sponsor video | READY TO RECORD AFTER LIVE GATES | Exact script and checklist are prepared |

A `BLOCKED` row is not a failed feature claim. It means the implementation exists but the required external evidence has not yet been produced. Sponsor copy must stay gated until the corresponding live check passes.
