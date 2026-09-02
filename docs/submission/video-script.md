# VeriRemit Demo Video Script

Target length: **2:55-3:10**. Screen recording plus narration; no face camera required.

> Recording gate: Groq reviewer, Nutrient extraction + Viewer, Doctavian generation/download, Foxit MCP, and the Foxit eSign human-signature round trip are all live-verified. Before recording, run one fresh canonical end-to-end pass from the exact submitted runtime so the video catches any expired short-lived credentials or provider-session drift. Do not record fixture mode and describe it as live sponsor behavior.

## 0:00-0:15 - Problem and plain prompt

**Screen**
- VeriRemit workbench on a fresh `created` case.
- Keep `LIVE PROVIDERS` badge visible.
- Cursor enters the prepared plain-language prompt and clicks **Run bounded agent**.

**Narration**

"Vendor payment fraud can hide inside an otherwise valid invoice. VeriRemit starts from one plain request: review this supplier packet, but never release a changed bank account without independent human verification."

## 0:15-0:42 - Groq reviewer, Nutrient extraction, deterministic block

**Screen**
- Show the bounded-agent action beginning.
- Show extraction completing.
- Status becomes `review required`.
- Rule list shows matching commercial controls and the red bank-account-continuity block.
- Show masked old and new IBANs.

**Narration**

"A bounded GPT-OSS reviewer runs through Groq, but it never decides whether this payment is safe. Nutrient extracts grounded facts with confidence and source locations. VeriRemit's deterministic rules compare the packet. The vendor, PO, amount and beneficiary align, but the requested IBAN differs from verified historical sources, so release is hard-blocked."

## 0:42-1:02 - Source evidence through Nutrient DWS Viewer

**Screen**
- Click the old verified IBAN source.
- Open the real DWS Viewer evidence session.
- Show the vendor-master field, then the current invoice/change field.

**Narration**

"The reviewer can go directly back to the source through a short-lived Nutrient DWS Viewer session. The human does not have to trust an AI summary: the conflicting values remain grounded in the actual documents."

## 1:02-1:27 - Human verification boundary

**Screen**
- Show trusted vendor-master phone.
- Briefly show the suspicious change-letter phone is different/untrusted.
- Record callback reference and reviewer.
- Status becomes `human approved`.

**Narration**

"A changed account cannot be cleared by another prompt. VeriRemit requires an independent callback using the contact that already existed in the vendor master. Contact details from the suspicious change notice are rejected. I record the real human verification here."

## 1:27-1:52 - Doctavian structured generation

**Screen**
- Ask the bounded agent to continue and prepare the release.
- Show `human approved` transitioning to release preparation.
- Highlight the Doctavian generation event or generated authorization in the UI/audit panel.
- Briefly show the generated authorization PDF.

**Narration**

"Only now can document generation run. VeriRemit sends approved structured case data to Doctavian. A deterministic provider-native DOCX template uses merge fields, a repeater over the verification controls, and a calculated control count to produce the Payment Release Authorization. The model does not free-write this financial document."

## 1:52-2:17 - Foxit reversible assembly and eSign request

**Screen**
- Continue the same bounded-agent operation.
- Show release reaching `release prepared` and then `signature pending`.
- If useful, show the tool-boundary text: `read · extract · prepare · request human signature`.

**Narration**

"The Doctavian PDF then enters Foxit's official MCP server. Foxit performs only reversible work: upload the authorization and evidence, merge the packet, and download the final PDF. Signing is intentionally outside that MCP allow-list. After the packet exists, the agent calls Foxit eSign directly to request a human signature."

## 2:17-2:43 - Real human Foxit signature

**Screen**
- Open the Foxit human signing session from the user-facing boundary.
- Complete the real signature in Foxit.
- Return to VeriRemit.
- Click **Refresh authoritative signature status**.

**Narration**

"This is the irreversible boundary. I am the signer, not the agent. After I sign, VeriRemit does not trust the browser redirect; it asks Foxit for the authoritative envelope status."

## 2:43-3:03 - Final state and audit proof

**Screen**
- Status becomes `release authorized`.
- Show `Hash chain verified`.
- Briefly scroll audit events: extraction, deterministic rules, human verification, Doctavian generation, Foxit MCP completion, eSign envelope, signature completed.

**Narration**

"Only confirmed provider completion moves the case to release authorized. Nutrient evidence, the human callback, Doctavian generation, Foxit packet assembly, and final signature state are all recorded in a tamper-evident hash chain. VeriRemit ends with a verified human-signed release document—and never executes the payment itself."

## 3:03-3:08 - End card

**Screen**
- VeriRemit title + one-line pitch.

**Narration**

"VeriRemit: AI may prepare the consequence. Deterministic controls and humans authorize it."

## Recording checklist

Before recording:

- reset the demo state with `npm run demo:reset`;
- confirm `npm run smoke:doctavian` passes with a fresh Microsoft OAuth bearer and the provisioned API key;
- confirm the already-verified Groq, Nutrient, Foxit MCP, and Foxit eSign credentials are still valid for the recording run;
- use synthetic/fictitious documents only;
- close tabs or terminals containing credentials;
- ensure no provider token, document ID, OAuth token, signing URL, or API key is visible;
- ensure the Foxit signer inbox is available for the fresh live human step;
- record one uninterrupted end-to-end run if possible;
- keep the final cut between 2 and 4 minutes;
- upload the public demo to YouTube or Vimeo for the Devpost video field;
- export and retain the original MP4, then upload it to a service that provides the required downloadable backup link for Devpost's submission field.
