# VeriRemit Recording Checklist

## Before recording

1. Confirm `docs/verification/live-provider-checklist.md` shows `PASS` for:
   - Nutrient Data Extraction;
   - Nutrient DWS Viewer;
   - Foxit PDF Services via official MCP;
   - Foxit eSign direct API.
2. Confirm the deployed workbench visibly shows `LIVE PROVIDERS`.
3. Confirm the configured signer email belongs to the person recording/signing the demo.
4. Run `npm run check:secrets`.
5. Run `npm run demo:reset` against the local/recording data directory before starting the live services.
6. Regenerate and inspect the five synthetic PDFs; every file must visibly say `DEMO - FICTIONAL DATA`.
7. Close unrelated tabs, notifications, terminals containing environment variables, provider consoles, and password-manager overlays.
8. Use a clean browser profile/window sized so the prompt, controls and right rail remain readable at 1080p.

## Recording path

1. Fresh `created` case.
2. Run the initial plain prompt.
3. Show Nutrient extraction result and bank-account hard block.
4. Open grounded evidence through DWS Viewer.
5. Record trusted callback using vendor-master phone only.
6. Run the suggested continuation prompt.
7. Show Foxit MCP release preparation and direct eSign request reaching `signature pending`.
8. Open the Foxit human signing session and actually sign.
9. Return to VeriRemit and refresh authoritative signature status.
10. End on `release authorized` + verified audit chain.

## Abort conditions

Stop the recording rather than hiding or editing around any of these:

- fixture-mode badge is visible;
- provider call fails or falls back to fixture behavior;
- source evidence cannot be opened;
- the changed IBAN is not hard-blocked;
- the agent prepares a release before human verification;
- the signing URL is exposed in model output/logs;
- signature status becomes complete only from a redirect rather than Foxit's API;
- any secret or private credential appears on screen.
