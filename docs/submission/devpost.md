# VeriRemit - Devpost Submission Copy

> Publishing gate: this copy targets the Nutrient, Doctavian, and Foxit sponsor tracks. Fixture behavior must never be presented as sponsor API proof. Live claims below are backed by `docs/verification/live-provider-checklist.md`.

## Project name

VeriRemit

## One-line pitch

VeriRemit catches suspicious vendor bank-detail changes from source documents, blocks unsafe payment-release workflows with deterministic controls, generates the approved authorization from structured data, and hands the final packet to a real human signer.

## Short description

A vendor invoice can look completely legitimate while changing only one field that matters: the bank account. VeriRemit reviews a synthetic supplier packet, extracts comparable facts with source provenance, detects a changed IBAN deterministically, and refuses to prepare a payment-release document until a human independently verifies the change using the pre-existing vendor-master contact.

After approval, Doctavian turns the approved structured case into a Payment Release Authorization. Foxit's MCP server performs only reversible PDF assembly, then Foxit eSign creates a real human-signature envelope through the direct API. VeriRemit never moves money and the agent never signs.

## Inspiration

Business-email-compromise and invoice-redirection attacks exploit an operational gap: companies receive legitimate-looking payment documents containing changed banking instructions, while the supporting evidence is spread across vendor masters, purchase orders, historical invoices, and change notices.

The engineering problem is not simply “can an LLM read an invoice?” It is deciding which work can be delegated to AI, which comparisons must be deterministic, which business action requires independent human verification, and where external document/signature providers should sit in that trust chain.

## What it does

1. A user starts with a plain-language request to review a vendor payment packet.
2. A bounded reviewer uses Groq `openai/gpt-oss-120b` through the OpenAI Agents SDK. It has only four case-scoped tools and cannot sign, approve a bank change, execute arbitrary HTTP, or authorize payment.
3. Nutrient DWS extracts structured facts from the documents with confidence and source locations.
4. VeriRemit's deterministic policy engine compares vendor identity, VAT ID, PO number, currency, amount, beneficiary, confidence, and bank-account continuity.
5. A changed bank account creates a hard block even when the rest of the packet matches.
6. The reviewer can inspect the source evidence through a short-lived Nutrient DWS Viewer session.
7. The bank change can be resolved only by recording an independent callback using the trusted contact stored in the vendor master; contact details from the suspicious change notice are rejected.
8. Only after the server-side release gate passes may VeriRemit send the approved structured case data to Doctavian. A deterministic provider-native DOCX template uses merge fields, a repeater over verification controls, and a calculated control count to generate the Payment Release Authorization PDF.
9. Foxit's official MCP server uploads that generated authorization PDF plus the source evidence, merges the packet, and downloads the final release document. The VeriRemit agent boundary statically allows only reversible document operations.
10. After the packet exists, the agent can request a Foxit eSign envelope through the direct eSign API. The agent cannot perform the signature.
11. A human signs in Foxit. VeriRemit accepts completion only after Foxit's authoritative envelope status reports completion.
12. Important state transitions—including structured generation, Foxit MCP completion, envelope creation, and final signature—are written to a SHA-256 hash-chained audit ledger. VeriRemit never executes a payment.

## Where Nutrient DWS does the heavy lifting

Nutrient DWS is VeriRemit's evidence layer: Data Extraction turns the source PDFs into comparable, grounded facts with confidence and page coordinates, while DWS Viewer gives the human reviewer a short-lived path back to the original evidence instead of asking them to trust an AI summary.

The live Nutrient proof completed both extraction and Viewer flows against the real provider.

## Where Doctavian does the heavy lifting

Doctavian is VeriRemit's approved-document generation layer. After deterministic controls and the trusted human callback clear the release gate, VeriRemit uploads a structured JSON representation of the approved case and a deterministic DOCX template. The template contains merge fields for the case/payment facts, a repeater over verification-control results, and a calculated control count. Doctavian generates the canonical Payment Release Authorization PDF that is then handed to Foxit for assembly.

The live Doctavian proof is complete: the Microsoft OAuth user preflight returned `200`, template upload returned `201`, data upload returned `201`, generation returned `201`, and the generated PDF downloaded with `200`. The downloaded VeriRemit PDF was inspected and contained the expected ACME Components case, two `PASS` controls, `CONTROL COUNT: 2`, the human-verification reference, amount/beneficiary/IBAN details, and the explicit no-payment-execution boundary.

A useful compatibility finding came from the live test. Generic programmatically authored DOCX packages uploaded successfully but were rejected by Doctavian's template reader. Doctavian's own Mission 1 template succeeded under the same account/API path. The working VeriRemit template therefore preserves that provider-native Maven Word package structure rather than assuming a generic DOCX writer produces an equivalent template.

## Where Foxit does the heavy lifting

Foxit's official MCP server performs the reversible final-packet work: upload the generated authorization, upload the supporting evidence, merge them, and download the final PDF. Foxit eSign is deliberately separate and called directly to create the human-signature envelope. The agent may prepare and request a signature, but only a person can sign, and the server independently verifies the final provider status.

The live Foxit proof is complete: a real MCP operation succeeded, a real developer-test eSign envelope was created and signed by a human, and a fresh authoritative Foxit lookup reported `EXECUTED` while activity history independently confirmed the signer action.

## How I built it

VeriRemit is a TypeScript monorepo with:

- React + Vite reviewer workbench;
- Fastify long-lived agent/API service;
- OpenAI Agents SDK with Groq `openai/gpt-oss-120b` as the zero-cost reviewer provider and an optional OpenAI fallback;
- a four-tool bounded agent surface;
- deterministic policy and explicit case-state packages;
- Nutrient Data Extraction and DWS Viewer adapters;
- a tracked provider-native Doctavian DOCX template plus typed upload/generation/download integration;
- a provider-boundary adapter that emits Doctavian's proven `{ data: { Release: [...] } }` shape without contaminating the internal domain model;
- Foxit's official stdio MCP server behind a static reversible-tool allow-list;
- direct Foxit eSign integration outside MCP;
- append-only hash-chained audit records;
- synthetic deterministic PDF fixtures clearly marked as fictional;
- unit, contract, integration, security and provider-composition coverage;
- Playwright golden-path browser tests;
- locked dependencies, Docker packaging, and container startup health verification.

The agent can inspect a case, start extraction, request release preparation, and request a human signature envelope. It cannot approve a bank change, sign, authorize payment, run shell commands, or make arbitrary HTTP requests.

## Challenges

The hardest boundary was making the agent useful without making it authoritative. A bank-account mismatch is therefore decided by normal code, not model judgment. The same principle applies to every consequential edge: structured generation cannot run before the deterministic/human gate, Foxit MCP handles reversible document operations, direct eSign creates the human handoff, and only authoritative Foxit status can move the case to `release_authorized`.

A second challenge was preserving evidence provenance across provider boundaries. Nutrient-specific extraction metadata is normalized while retaining confidence, page, bounding-box, and source-document references needed by the reviewer. The approved normalized state is then rendered into structured generation data and an auditable authorization rather than asking a model to free-write the financial document.

Provider contracts also differ materially. Doctavian requires API-key plus OAuth authorization and proved sensitive to the DOCX package structure used by its Maven Word authoring path. Foxit MCP is a long-lived stdio process while eSign is direct HTTP. Nutrient's extraction endpoint accepts a deliberately restricted JSON-Schema subset. The implementation was narrowed to the contracts actually proven against the providers instead of preserving assumptions that only passed locally.

## Accomplishments

- A changed IBAN hard-blocks release even when all commercial fields match.
- A suspicious change-letter phone number cannot be used as the trusted verification source.
- Corrupting the audit chain disables consequential actions.
- Structured generation cannot run without approved release data.
- The Doctavian template includes merge fields, repeated verification-control rows, and a calculated control count.
- Foxit signing is absent from the MCP capability surface exposed to the VeriRemit agent.
- Foxit MCP accepts the Doctavian-generated PDF directly without re-generating it from model-produced HTML.
- The agent can request a direct eSign envelope only after the server has prepared an approved release.
- Signing-session URLs are never returned to the language model.
- Final authorization requires authoritative signature completion, not a browser redirect.
- Sponsor adapters and fixture behavior are explicitly separated so local fixtures cannot be misrepresented as live API evidence.
- The CI baseline passes 123/123 tests, strict TypeScript checks, production build, secret scan, Chromium E2E, Docker build, and real container `/health` startup.
- The real Groq bounded-reviewer smoke passed.
- The real Nutrient extraction and DWS Viewer flows passed.
- The real Doctavian structured generation and PDF download passed with the canonical VeriRemit case.
- The real Foxit MCP reversible PDF smoke passed.
- The real Foxit eSign human-signature round trip reached authoritative `EXECUTED` state with a recorded signer action.

## Current live verification

**PASS:** Groq bounded reviewer, Nutrient Data Extraction, Nutrient DWS Viewer, Doctavian generation/download, Foxit PDF Services MCP, Foxit direct eSign, real human Foxit signature, authoritative Foxit completion.

Before recording, I will run one fresh canonical end-to-end pass from the exact submitted code so the video also catches any short-lived credential/session drift. That is a recording-readiness check, not an unresolved sponsor integration.

## What I learned

Agent safety is easier to reason about when authority is moved out of the prompt. Prompts explain intent; deterministic code owns invariants; state machines own transitions; provider adapters own external contracts; structured generation owns the approved document; humans own the decisions that should remain human.

The Doctavian debugging also reinforced a narrower engineering lesson: a file being a structurally valid DOCX does not mean it is equivalent to a provider-authored template. When a provider has an authoring/runtime contract, preserve and test that contract rather than abstracting it away prematurely.

## What's next

Run the final fresh end-to-end sponsor pass from the submitted runtime, then record the 2-4 minute demo. The final Devpost submission also requires a public YouTube/Vimeo demo URL and a downloadable backup link to the original MP4. After those deliverables exist, opt into the Nutrient, Doctavian, and Foxit sponsor tracks and submit before the hackathon deadline.

For a post-hackathon product, the next steps would be configurable policy packs for accounts-payable teams, ERP/vendor-master integrations, independent callback workflows, durable transactional storage, authenticated multi-user access, and externally anchored audit evidence.

## Built with

TypeScript, React, Vite, Fastify, OpenAI Agents SDK, Groq GPT-OSS 120B, Nutrient DWS Data Extraction, Nutrient DWS Viewer, Doctavian Document Generation API, Foxit PDF Services MCP, Foxit eSign API, Node.js, Playwright, Docker.

## Source requirements used for this submission

- Hackathon overview and judging: https://api-cloud-ai-hackathon-2026.devpost.com/
- Foxit challenge: https://api-cloud-ai-hackathon-2026.devpost.com/updates/45978-new-hackathon-challenge-your-agent-shouldn-t-sign-that
- Nutrient challenge: https://api-cloud-ai-hackathon-2026.devpost.com/updates/45981-ai-documents-1-500-in-prizes-take-on-the-nutrient-hackathon-challenge
- Doctavian challenge: https://api-cloud-ai-hackathon-2026.devpost.com/updates/45979-hackathon-sponsor-spotlight-build-smarter-documents-with-doctavian
