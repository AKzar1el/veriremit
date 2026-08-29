# VeriRemit - Devpost Submission Copy

> Publishing gate: use this copy for the Nutrient and Foxit sponsor tracks only after the relevant rows in `docs/verification/live-provider-checklist.md` are marked `PASS` from real provider calls. Fixture behavior must never be presented as sponsor API proof.

## Project name

VeriRemit

## One-line pitch

VeriRemit catches suspicious vendor bank-detail changes from source documents, blocks unsafe payment-release workflows with deterministic controls, and hands a verified release to a real human signer.

## Short description

A vendor invoice can look completely legitimate while changing only one field that matters: the bank account. VeriRemit reviews a synthetic supplier packet, extracts comparable facts with source provenance, detects a changed IBAN deterministically, and refuses to prepare a payment-release document until a human independently verifies the change using the pre-existing vendor-master contact.

After approval, a bounded agent uses Foxit's MCP server only for reversible PDF operations, requests a Foxit eSign envelope through the direct API, and hands the final signature to a human. VeriRemit does not move money.

## Inspiration

Business-email-compromise and invoice-redirection attacks exploit an operational gap: companies receive legitimate-looking payment documents containing changed banking instructions, while the supporting evidence is spread across vendor masters, purchase orders, historical invoices, and change notices.

The interesting engineering problem is not "can an LLM read an invoice?" It is deciding which work can be delegated to AI and which decisions must remain deterministic or human-controlled.

## What it does

1. A user starts with a plain-language request to review a vendor payment packet.
2. Nutrient DWS extracts structured facts from the documents with confidence and source locations.
3. VeriRemit's deterministic policy engine compares vendor identity, VAT ID, PO number, currency, amount, beneficiary, confidence, and bank-account continuity.
4. A changed bank account creates a hard block even when the rest of the packet matches.
5. The reviewer can inspect the source evidence through a short-lived read-only Nutrient DWS Viewer session.
6. The bank change can be resolved only by recording an independent callback using the trusted contact stored in the vendor master; contact details from the suspicious change notice are rejected.
7. The agent may then ask Foxit's official MCP server to upload, generate, merge, and download the release packet. The MCP allow-list contains only reversible document tools.
8. After the release is prepared, the agent can request a Foxit eSign envelope through the direct eSign API. The agent cannot perform the signature.
9. A human signs in Foxit. VeriRemit accepts completion only after Foxit's authoritative envelope status reports completion.
10. Every important state transition is written to a SHA-256 hash-chained audit ledger. VeriRemit never executes a payment.

## Where Nutrient DWS does the heavy lifting

Nutrient DWS is VeriRemit's evidence layer: Data Extraction turns the source PDFs into comparable, grounded facts with confidence and page coordinates, while DWS Viewer gives the human reviewer a short-lived read-only path back to the exact source document instead of asking them to trust an AI summary.

## Where Foxit does the heavy lifting

Foxit's official MCP server performs the reversible release-document work, while Foxit eSign is called separately to create the human-signature envelope. That separation is deliberate: the agent may prepare and request a signature, but only a person can sign, and the server independently verifies the final provider status.

## How I built it

VeriRemit is a TypeScript monorepo with:

- React + Vite reviewer workbench;
- Fastify long-lived agent/API service;
- OpenAI Agents SDK with `gpt-5-nano` and a four-tool bounded surface;
- deterministic policy and explicit case-state packages;
- Nutrient Data Extraction and DWS Viewer adapters;
- Foxit's official stdio MCP server behind a static reversible-tool allow-list;
- direct Foxit eSign integration outside MCP;
- append-only hash-chained audit records;
- synthetic, deterministic PDF fixtures clearly marked as fictional;
- unit, contract, integration, and security coverage, plus a Playwright golden-path browser specification.

The agent can inspect a case, start extraction, request release preparation, and request a human signature envelope. It cannot approve a bank change, sign, authorize payment, run shell commands, or make arbitrary HTTP requests.

## Challenges

The hardest boundary was making the agent useful without making it authoritative. A bank-account mismatch is therefore decided by normal code, not model judgment. The same principle applies to the irreversible edge: Foxit MCP handles reversible document operations, direct eSign creates the human handoff, and only authoritative provider status can move the case to `release_authorized`.

A second challenge was preserving evidence provenance across provider boundaries. Nutrient-specific extraction metadata is normalized at the adapter boundary while retaining confidence, page, bounding-box, and source-document references needed by the reviewer.

## Accomplishments

- A changed IBAN hard-blocks release even when all commercial fields match.
- A suspicious change-letter phone number cannot be used as the trusted verification source.
- Corrupting the audit chain disables consequential actions.
- Foxit signing is absent from the MCP tool catalog used by VeriRemit.
- The agent can request a direct eSign envelope only after the server has prepared an approved release.
- Signing-session URLs are never returned to the language model.
- Final authorization requires authoritative signature completion, not a browser redirect.
- Sponsor adapters and fixture behavior are explicitly separated so local fixtures cannot be misrepresented as live API evidence.

## What I learned

Agent safety is easier to reason about when authority is moved out of the prompt. Prompts explain intent; deterministic code owns invariants; state machines own transitions; provider adapters own external contracts; humans own the decisions that should remain human.

## What's next

The next product step would be configurable policy packs for accounts-payable teams, ERP/vendor-master integrations, independent callback workflows, and exception analytics. The architecture is intentionally narrow enough to add those capabilities without turning the language model into the system of record.

## Built with

TypeScript, React, Vite, Fastify, OpenAI Agents SDK, GPT-5 nano, Nutrient DWS Data Extraction, Nutrient DWS Viewer, Foxit PDF Services MCP, Foxit eSign API, Node.js, Playwright, Docker.

## Source requirements used for this submission

- Hackathon overview and judging: https://api-cloud-ai-hackathon-2026.devpost.com/
- Foxit challenge update: https://api-cloud-ai-hackathon-2026.devpost.com/updates/45978-new-hackathon-challenge-your-agent-shouldn-t-sign-that
- Nutrient challenge requirements: https://api-cloud-ai-hackathon-2026.devpost.com/
