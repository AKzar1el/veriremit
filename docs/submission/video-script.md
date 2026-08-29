# VeriRemit Demo Video Script

Target length: **2:45-2:55**. Screen recording plus narration; no face camera required.

> Recording gate: record the sponsor submission only in live-provider mode after Nutrient extraction + Viewer and Foxit MCP + eSign checks are `PASS`. Do not record fixture mode and describe it as live sponsor behavior.

## 0:00-0:15 - Problem and plain prompt

**Screen**
- VeriRemit workbench on a fresh `created` case.
- Keep `LIVE PROVIDERS` badge visible.
- Cursor enters the already prepared plain-language prompt and clicks **Run bounded agent**.

**Narration**

"Vendor payment fraud can hide inside an otherwise valid invoice. VeriRemit starts from one plain request: review this supplier packet, but never release a changed bank account without human verification."

## 0:15-0:42 - Nutrient extraction and deterministic block

**Screen**
- Show extraction completing.
- Status becomes `review required`.
- Rule list shows the matching commercial controls and the red bank-account-continuity block.
- Show masked old and new IBANs.

**Narration**

"Nutrient extracts the documents into grounded facts with confidence and source locations. The model does not decide whether this is safe. VeriRemit's deterministic rules do. The vendor, VAT number, PO, amount, currency and beneficiary match, but the payment IBAN changed, so release is hard-blocked."

## 0:42-1:05 - Source evidence through Nutrient DWS Viewer

**Screen**
- Click the old verified IBAN source.
- Open the DWS Viewer evidence session.
- Show the verified vendor-master field, then the current invoice/change field.

**Narration**

"The reviewer can go straight back to the source evidence through a short-lived, read-only Nutrient DWS Viewer session. This is why the human does not have to trust an AI explanation: the conflicting values are grounded in the documents themselves."

## 1:05-1:30 - Human verification boundary

**Screen**
- Show trusted vendor-master phone `+49 30 555 0104`.
- Briefly show the suspicious change-letter phone is different/untrusted.
- Record callback reference `VR-2026-4821` and reviewer `Demo Finance Controller`.
- Status becomes `human approved`.

**Narration**

"A changed bank account cannot be cleared by another prompt. VeriRemit requires an independent callback using the contact that existed in the vendor master before this request. Contact details from the change letter are rejected. I record that human verification here."

## 1:30-2:02 - Agent performs Foxit reversible work and requests eSign

**Screen**
- The suggested prompt now asks the agent to continue, prepare the payment-release authorization, and request the configured human signature.
- Click **Run bounded agent**.
- Show status advancing through release preparation to `signature pending`.
- If useful, briefly show the UI boundary text: `read · extract · prepare · request human signature`.

**Narration**

"Now the agent can continue. Foxit's official MCP server handles only reversible document work: upload, HTML-to-PDF conversion, merge, and download. Signing is not in that MCP allow-list. After the gated release exists, the agent calls Foxit eSign directly to request a human signature. It still cannot sign, approve the bank change, or move money."

## 2:02-2:30 - Real human Foxit signature

**Screen**
- Click **Open Foxit human signing session**.
- Complete the real signature in Foxit.
- Return to VeriRemit.
- Click **Refresh authoritative signature status**.

**Narration**

"This is the irreversible boundary. I am the signer, not the agent. After I sign, VeriRemit does not trust the redirect; it asks Foxit for the authoritative envelope status."

## 2:30-2:50 - Final state and audit proof

**Screen**
- Status becomes `release authorized`.
- Show `Hash chain verified`.
- Briefly scroll audit events: extraction, rule evaluation, human verification, Foxit MCP completion, eSign envelope, signature completed.

**Narration**

"Only confirmed provider completion moves the case to release authorized. Every important event is hash-chained for tamper evidence. VeriRemit ends with a verified, human-signed release document - and never executes the payment itself."

## 2:50-2:55 - End card

**Screen**
- VeriRemit title + one-line pitch.

**Narration**

"VeriRemit: AI may prepare the consequence. Deterministic controls and humans authorize it."
