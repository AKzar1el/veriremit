# Security policy

VeriRemit is a hackathon demonstration of a safety boundary for document-driven payment release workflows. It does **not** move money, change ERP/vendor-master data, or permit an AI model to authorize or sign on behalf of a human.

## Security invariants

- Deterministic rules, not the language model, decide whether evidence mismatches block release.
- A changed bank account requires an independently recorded trusted callback sourced from the pre-existing vendor master.
- The bounded reviewer has no signing, shell, arbitrary HTTP, or payment tool. Groq is used through the OpenAI Agents SDK when configured; an OpenAI model is only an optional fallback.
- Nutrient supplies grounded evidence and Viewer access, but extracted data does not bypass VeriRemit's deterministic policy.
- Doctavian document generation can run only after the server-side release gate passes. The provider receives structured approved data and a deterministic template rather than model-authored release text.
- Foxit MCP is statically restricted to reversible document operations. eSign is a separate server-side API boundary.
- Consequential operations re-verify the tamper-evident audit chain before provider calls.
- Doctavian generation, Foxit MCP completion, release preparation, eSign creation, and final signature completion are represented in the audit chain.
- Browser clients receive sanitized case data and short-lived viewer/signing session data only; provider credentials stay server-side.
- Synthetic demo documents are visibly fictional and fixture behavior must never be represented as live-provider evidence.

## Production boundary

The hackathon runtime is hardened for a **single controlled instance**, but it is not a regulated-production payment system. In particular:

- The HTTP API does not implement end-user authentication. **CORS is not access control.** Any live deployment must remain private/local or sit behind an authenticated reverse proxy/access layer; do not expose the live API directly to the public internet.
- Filesystem persistence is atomic for this single-process demo and consequential case operations are serialized per case. It is not a distributed transaction/idempotency system and must not be horizontally scaled as-is.
- The SHA-256 audit chain detects accidental/partial tampering, but an administrator with write access could rewrite and re-hash the full ledger. Regulated production should use append-only/WORM or KMS-signed externally anchored audit storage.
- Live provider requests are bounded by timeouts and consequential eSign creation is not blindly retried. Production retry/idempotency policy should be based on provider-supported idempotency primitives.
- Dependency versions are pinned, `package-lock.json` is committed, CI and the agent container use `npm ci`, and CI performs a high-severity production dependency audit.
- The Doctavian hackathon integration currently requires both a provisioned API key and an OAuth bearer access token. Bearer acquisition/refresh should move to a dedicated server-side OAuth credential lifecycle before any production deployment.

These constraints do not affect the hackathon safety claim that the model cannot authorize payment or perform the human signature.

## Secrets

Never commit API keys, OAuth bearer tokens, fine-grained GitHub tokens, Cloudflare tokens, eSign credentials, viewer credentials, or webhook secrets. Use ignored local env files during development and a deployment secret store in hosted environments. `npm run check:secrets` scans tracked text files for high-risk OpenAI, GitHub, Cloudflare, Groq, and Doctavian credential patterns and reports only token type, path, and line number; it never prints the matched value.

If a credential is exposed in chat, terminal output, git history, screenshots, or video, revoke/rotate it before the final live demonstration.

## Live-provider verification

Live Groq, Nutrient, Doctavian and Foxit smoke tests are manual and credential-gated. CI runs deterministic fixture/provider-contract tests without live secrets. A failed live integration must remove or narrow the corresponding submission claim rather than being substituted with a mock.

The real Foxit signature is intentionally not automatable: a human signer must complete the signature and VeriRemit must verify the authoritative provider status afterward.

## Reporting

Use the repository's private security-reporting path where available. Do not place credentials, provider tokens, signing-session URLs, or sensitive operational details in a public issue.
