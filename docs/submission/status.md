# Submission Readiness Status

Last updated: 2026-08-29

| Gate | Status | Evidence / blocker |
| --- | --- | --- |
| Core deterministic workflow | PASS | `npm test`: 109 tests passing; core/provider typechecks passing; secret scan and `git diff --check` clean |
| Prompt-first agent boundary | PASS | Case-scoped route + bounded tools + UI tests |
| Synthetic PDF packet | PASS | Deterministic generation + text/visual QA |
| Nutrient adapter contract | PASS | Official-response contract tests |
| Foxit MCP adapter contract | PASS | Official-tool contract tests |
| Foxit eSign adapter contract | PASS | Direct API contract tests |
| Live Nutrient extraction | BLOCKED | Sponsor API credential not configured |
| Live Nutrient DWS Viewer | BLOCKED | Sponsor Viewer credential not configured |
| Live Foxit MCP | BLOCKED | Foxit developer credentials not configured |
| Live Foxit eSign + human signature | BLOCKED | Foxit credentials/signer not configured |
| Public GitHub repository | REPAIR REQUIRED | Repository exists, but the previously published `main` was independently found incomplete; hardened source must be republished and re-verified before submission |
| Hosted live deployment | BLOCKED | No authenticated live deployment with sponsor credentials yet |
| Dependency lock / reproducible install | BLOCKED | No `package-lock.json` yet; generate in a networked clean clone, commit it, switch CI/Docker to `npm ci`, then run dependency audit |
| Public live API access control | BLOCKED FOR PUBLIC HOSTING | CORS is configured but authentication is intentionally external; keep live API private/local or protect it with an authenticated access proxy |
| Browser Playwright execution | BLOCKED IN CURRENT SANDBOX | Golden-path Playwright spec is authored; external npm packages are unavailable in this runtime, so run it in GitHub CI after source publication |
| 2-4 minute sponsor video | READY TO RECORD AFTER LIVE GATES | Exact script and checklist are prepared |

A `BLOCKED` row is not a failed feature claim. It means the implementation exists but the required external evidence has not yet been produced. Sponsor copy must stay gated until the corresponding live check passes.
