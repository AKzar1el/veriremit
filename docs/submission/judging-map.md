# VeriRemit Judging Map

This file maps the build to the current DevNetwork, Nutrient, and Foxit criteria. It is an internal pre-submission check, not marketing copy.

## Overall DevNetwork judging

Current Devpost criteria are **Progress**, **Concept**, and **Feasibility**.

| Criterion | VeriRemit evidence | Demo moment |
| --- | --- | --- |
| Progress | Working domain/state machine, deterministic policy, audit chain, UI, bounded agent, Nutrient adapters, Foxit MCP/eSign adapters, live composition, CI/security controls, synthetic PDF packet, deployment packaging | End-to-end flow rather than slides |
| Concept | Vendor bank-change fraud is a narrow real business problem with a clear operational consequence | Changed IBAN hard-block while other invoice fields match |
| Feasibility | Provider-neutral boundaries, explicit states, long-lived MCP agent service, configurable deployment origins, local persistence, isolated provider adapters | Show that each external service owns one clear responsibility |

Source: https://api-cloud-ai-hackathon-2026.devpost.com/

## Nutrient DWS challenge

Current challenge requires Nutrient DWS to perform a **meaningful core document operation** and specifically values deterministic/auditable pipelines with human review. It asks for a public repo/shared link, a 2-4 minute end-to-end demo, and one line explaining where DWS does the heavy lifting.

| Requirement / signal | VeriRemit implementation | Evidence gate |
| --- | --- | --- |
| Meaningful DWS usage | Data Extraction is the source-fact ingestion layer; DWS Viewer is the reviewer evidence layer | Live extraction + live Viewer smoke must pass |
| Grounded confidence/provenance | Adapter preserves value, confidence, page and bounding-box/source data | Contract tests use Nutrient's own committed grounded-extraction response shape |
| Human in the loop | Changed bank account cannot be released until trusted callback is recorded | Deterministic CaseService + reviewer UI |
| Auditability | Every critical event is appended to a SHA-256 hash chain | Audit tests + final `Hash chain verified` UI |
| End-to-end demo | Extraction -> mismatch -> evidence -> human callback -> release -> signature | `video-script.md` |

Source: https://api-cloud-ai-hackathon-2026.devpost.com/

## Foxit challenge

Current Foxit challenge asks for an agent that **starts from a plain prompt and ends with a signed document**. Reversible document work should use Foxit's MCP server; the eSign API is called directly; a human must actually sign; the agent-human boundary is central.

| Requirement / signal | VeriRemit implementation | Evidence gate |
| --- | --- | --- |
| Starts from plain prompt | Reviewer workbench exposes a case-scoped agent prompt at the top of the flow | Prompt route + UI + tests |
| Foxit MCP is meaningful | Static allow-list: `upload_document`, `pdf_from_html`, `pdf_merge`, `download_document` | Live MCP smoke must pass |
| Direct eSign outside MCP | Agent's `request_human_signature` delegates to the server-side direct Foxit eSign adapter only after `release_prepared` | Live eSign smoke + recorded demo |
| Human actually signs | Signing URL is surfaced only to the reviewer UI; model output strips it | Real recording must show human completing Foxit signature |
| Defensible boundary | Agent can request a signing envelope but cannot perform a signature, approve verification, authorize payment, use shell, or make arbitrary HTTP requests | Tool-boundary tests + narration |
| Authoritative completion | Browser redirect is insufficient; `release_authorized` requires Foxit status `completed` | Signature-state tests + final demo refresh |

Source: https://api-cloud-ai-hackathon-2026.devpost.com/updates/45978-new-hackathon-challenge-your-agent-shouldn-t-sign-that

## Non-negotiable submission gates

- Do not claim Nutrient live use until Data Extraction and DWS Viewer checks are `PASS`.
- Do not claim Foxit live use until MCP and eSign checks are `PASS` and a human has completed the test signature.
- Do not publish a fixture-mode sponsor demo as if it were a live provider run.
- Do not include API keys, Viewer JWTs, embedded signing URLs, webhook secrets, or raw provider identifiers in screenshots, logs, repository files, or narration.
- Public repository exists; keep the Devpost repository link gated on a green clean-clone CI run and secret scan.
