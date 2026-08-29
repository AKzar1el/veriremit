import type { RuleResult, VerificationCase } from '@veriremit/domain';


const REQUIRED_RULE_CODES: readonly RuleResult['code'][] = [
  'vendor_id_match',
  'vat_id_match',
  'po_number_match',
  'currency_match',
  'invoice_amount_matches_po',
  'beneficiary_name_match',
  'bank_change_vendor_match',
  'bank_change_request_match',
  'bank_account_continuity',
  'critical_confidence_threshold',
];
const REQUIRED_RULE_CODE_SET = new Set<string>(REQUIRED_RULE_CODES);

export interface ReleaseGateDecision {
  allowed: boolean;
  reasons: readonly string[];
}

export function evaluateReleaseGate(value: VerificationCase): ReleaseGateDecision {
  const reasons: string[] = [];

  if (value.status !== 'human_approved') {
    reasons.push(`case_status:${value.status}`);
  }

  const counts = new Map<string, number>();
  for (const rule of value.rules) counts.set(rule.code, (counts.get(rule.code) ?? 0) + 1);
  for (const code of REQUIRED_RULE_CODES) {
    const count = counts.get(code) ?? 0;
    if (count === 0) reasons.push(`rules_missing:${code}`);
    if (count > 1) reasons.push(`rules_duplicate:${code}`);
  }
  for (const code of counts.keys()) {
    if (!REQUIRED_RULE_CODE_SET.has(code)) reasons.push(`rules_unknown:${code}`);
  }

  for (const rule of value.rules) {
    if (rule.outcome === 'PASS') {
      continue;
    }

    if (rule.code === 'bank_account_continuity' && rule.outcome === 'BLOCK') {
      if (value.humanVerification?.result !== 'confirmed') {
        reasons.push('bank_account_continuity:unverified_change');
      }
      continue;
    }

    reasons.push(`${rule.code}:${rule.outcome.toLowerCase()}`);
  }

  return {
    allowed: reasons.length === 0,
    reasons,
  };
}
