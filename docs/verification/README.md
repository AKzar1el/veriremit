# Verification Evidence

This directory contains sanitized evidence for the VeriRemit hackathon build.

The project distinguishes three levels of evidence:

1. **Fixture-verified** - deterministic local behavior exercised against synthetic data. This proves application policy, state transitions, audit integrity, and UI/service sequencing; it is not evidence of a sponsor API call.
2. **Contract-verified** - adapters are implemented against current official documentation and/or official provider sample responses, with provider-facing request/response mapping covered by tests.
3. **Live-verified** - the actual sponsor service was called with real developer credentials and the required end-to-end behavior completed successfully.

`live-provider-checklist.md` is the source of truth for live sponsor status. Until a row is changed from `BLOCKED` to `PASS` after a successful real call, README/Devpost/video copy must not describe that provider path as live-verified.

Never place API keys, access tokens, viewer JWTs, signing URLs, webhook secrets, or raw provider credentials in this directory.
