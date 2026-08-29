# Security policy

VeriRemit is a hackathon demonstration of a safety boundary for document-driven payment release workflows. It does **not** move money, change ERP/vendor-master data, or permit an AI model to authorize or sign on behalf of a human.

## Security invariants

- Deterministic rules, not the language model, decide whether evidence mismatches block release.
- A changed bank account requires an independently recorded trusted callback sourced from the pre-existing vendor master.
- The OpenAI agent has no signing, shell, arbitrary HTTP, or payment tool.
- Foxit MCP is statically restricted to reversible document operations. eSign is a separate server-side API boundary.
- Consequential operations re-verify the tamper-evident audit chain before provider calls.
- Browser clients receive sanitized case data and short-lived viewer/signing session data only; provider credentials stay server-side.
- Synthetic demo documents are visibly marked fictional and must never be represented as live-provider evidence.

## Production boundary

The hackathon runtime is hardened for a **single controlled instance**, but it is not a regulated-production payment system. In particular:

- The HTTP API does not implement end-user authentication. **CORS is not access control.** Any live deployment must remain private/local or sit behind an authenticated reverse proxy/access layer; do not expose the live API directly to the public internet.
- Filesystem persistence is atomic for this single-process demo and consequential case operations are serialized per case. It is not a distributed transaction/idempotency system and must not be horizontally scaled as-is.
- The SHA-256 audit chain detects accidental/partial tampering, but an administrator with write access could rewrite and re-hash the full ledger. Regulated production should use append-only/WORM or KMS-signed externally anchored audit storage.
- Live provider requests are bounded by timeouts and consequential eSign creation is not blindly retried. Production retry/idempotency policy should be based on provider-supported idempotency primitives.
- Dependency versions are directly pinned, but a generated `package-lock.json` is still required before claiming reproducible supply-chain builds; CI should then use `npm ci` and a dependency vulnerability audit.

These constraints do not affect the hackathon safety claim that the model cannot authorize payment or perform the human signature.

## Secrets

Never commit API keys, fine-grained GitHub tokens, Cloudflare tokens, eSign credentials, viewer credentials, or webhook secrets. Use ignored local env files during development and a deployment secret store in hosted environments. `npm run check:secrets` scans tracked text files and reports only token type, path, and line number; it never prints the matched value.

If a credential is exposed in chat, terminal output, git history, screenshots, or video, revoke/rotate it before continuing.

## Live-provider verification

Live Nutrient and Foxit smoke tests are manual and credential-gated. CI runs only deterministic fixture-provider tests. A failed live integration must remove or narrow the corresponding submission claim rather than being substituted with a mock.

## Reporting

Until a public repository is created, report security issues directly to the project maintainer through the contact channel associated with the submitted Devpost/GitHub profile. Once GitHub Security Advisories are available for the repository, prefer a private advisory over a public issue for sensitive reports.
