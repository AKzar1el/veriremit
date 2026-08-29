import type {
  DocumentKind,
  ExtractedDocument,
  ExtractedFact,
  RuleEvidence,
  RuleResult,
} from '@veriremit/domain';
import {
  normalizeCurrency,
  normalizeIban,
  normalizeIdentifier,
  normalizeMoney,
  normalizeName,
  normalizeVatId,
} from './normalize.ts';

export interface PolicyPacket {
  documents: readonly ExtractedDocument[];
}

type Fact = ExtractedFact<string | number>;

type Normalizer = (value: string | number) => string;

function documentOf(packet: PolicyPacket, kind: DocumentKind): ExtractedDocument | undefined {
  return packet.documents.find((document) => document.kind === kind);
}

function factOf(document: ExtractedDocument | undefined, field: string): Fact | undefined {
  return document?.facts.find((fact) => fact.field === field);
}

function normalized(fact: Fact | undefined, normalize: Normalizer): string | undefined {
  if (!fact) return undefined;
  try {
    return normalize(fact.value);
  } catch {
    return undefined;
  }
}

function evidence(label: string, fact: Fact | undefined, normalize: Normalizer): RuleEvidence {
  let value = 'MISSING';
  if (fact) {
    try {
      value = normalize(fact.value);
    } catch {
      value = 'INVALID';
    }
  }
  return {
    label,
    value,
    ...(fact ? { source: fact.source } : {}),
  };
}

function exactRule(input: {
  code: RuleResult['code'];
  leftLabel: string;
  left: Fact | undefined;
  rightLabel: string;
  right: Fact | undefined;
  normalize: Normalizer;
  passMessage: string;
  failMessage: string;
}): RuleResult {
  const leftValue = normalized(input.left, input.normalize);
  const rightValue = normalized(input.right, input.normalize);
  const resultEvidence = [
    evidence(input.leftLabel, input.left, input.normalize),
    evidence(input.rightLabel, input.right, input.normalize),
  ];

  if (leftValue === undefined || rightValue === undefined) {
    return {
      code: input.code,
      outcome: 'REVIEW',
      message: 'Required comparison evidence is missing.',
      evidence: resultEvidence,
    };
  }

  if (leftValue === rightValue) {
    return {
      code: input.code,
      outcome: 'PASS',
      message: input.passMessage,
      evidence: resultEvidence,
    };
  }

  return {
    code: input.code,
    outcome: 'BLOCK',
    message: input.failMessage,
    evidence: resultEvidence,
  };
}

const asIdentifier: Normalizer = (value) => normalizeIdentifier(String(value));
const asVat: Normalizer = (value) => normalizeVatId(String(value));
const asCurrency: Normalizer = (value) => normalizeCurrency(String(value));
const asMoney: Normalizer = (value) => normalizeMoney(value);
const asName: Normalizer = (value) => normalizeName(String(value));
const asIban: Normalizer = (value) => normalizeIban(String(value));

const CRITICAL_FIELDS = new Set([
  'vendor_id',
  'vat_id',
  'po_number',
  'currency',
  'amount',
  'beneficiary_name',
  'iban',
]);

function confidenceRule(packet: PolicyPacket): RuleResult {
  const criticalFacts = packet.documents.flatMap((document) =>
    document.facts.filter((fact) => CRITICAL_FIELDS.has(fact.field)),
  );
  const uncertain = criticalFacts.filter(
    (fact) => fact.confidence === undefined || fact.confidence < 0.9,
  );

  if (criticalFacts.length === 0 || uncertain.length > 0) {
    return {
      code: 'critical_confidence_threshold',
      outcome: 'REVIEW',
      message:
        uncertain.length > 0
          ? 'At least one critical extracted field is below the 0.90 confidence threshold or has no confidence signal.'
          : 'No critical extraction confidence evidence is available.',
      evidence: uncertain.map((fact) => ({
        label: `${fact.source.filename}:${fact.field}`,
        value: fact.confidence === undefined ? 'UNAVAILABLE' : fact.confidence.toFixed(2),
        source: fact.source,
      })),
    };
  }

  return {
    code: 'critical_confidence_threshold',
    outcome: 'PASS',
    message: 'All critical extracted fields meet the 0.90 confidence threshold.',
    evidence: [],
  };
}

function bankContinuityRule(packet: PolicyPacket): RuleResult {
  const vendor = documentOf(packet, 'vendor_master');
  const previous = documentOf(packet, 'previous_invoice');
  const current = documentOf(packet, 'current_invoice');

  const vendorIban = factOf(vendor, 'iban');
  const previousIban = factOf(previous, 'iban');
  const currentIban = factOf(current, 'iban');
  const resultEvidence = [
    evidence('verified vendor master', vendorIban, asIban),
    evidence('previous verified invoice', previousIban, asIban),
    evidence('current invoice', currentIban, asIban),
  ];

  const vendorValue = normalized(vendorIban, asIban);
  const previousValue = normalized(previousIban, asIban);
  const currentValue = normalized(currentIban, asIban);

  if (vendorValue === undefined || previousValue === undefined || currentValue === undefined) {
    return {
      code: 'bank_account_continuity',
      outcome: 'REVIEW',
      message: 'Bank-account continuity cannot be established from the available source documents.',
      evidence: resultEvidence,
    };
  }

  if (vendorValue === currentValue && previousValue === currentValue) {
    return {
      code: 'bank_account_continuity',
      outcome: 'PASS',
      message: 'Current invoice bank account matches verified historical bank details.',
      evidence: resultEvidence,
    };
  }

  return {
    code: 'bank_account_continuity',
    outcome: 'BLOCK',
    message: 'Current invoice bank account differs from verified historical bank details.',
    evidence: resultEvidence,
  };
}

export function evaluatePacket(packet: PolicyPacket): RuleResult[] {
  const vendor = documentOf(packet, 'vendor_master');
  const purchaseOrder = documentOf(packet, 'purchase_order');
  const current = documentOf(packet, 'current_invoice');
  const bankChange = documentOf(packet, 'bank_change_letter');

  return [
    exactRule({
      code: 'vendor_id_match',
      leftLabel: 'vendor master',
      left: factOf(vendor, 'vendor_id'),
      rightLabel: 'current invoice',
      right: factOf(current, 'vendor_id'),
      normalize: asIdentifier,
      passMessage: 'Vendor identifiers match.',
      failMessage: 'Vendor identifier differs from the verified vendor record.',
    }),
    exactRule({
      code: 'vat_id_match',
      leftLabel: 'vendor master',
      left: factOf(vendor, 'vat_id'),
      rightLabel: 'current invoice',
      right: factOf(current, 'vat_id'),
      normalize: asVat,
      passMessage: 'VAT identifiers match.',
      failMessage: 'VAT identifier differs from the verified vendor record.',
    }),
    exactRule({
      code: 'po_number_match',
      leftLabel: 'purchase order',
      left: factOf(purchaseOrder, 'po_number'),
      rightLabel: 'current invoice',
      right: factOf(current, 'po_number'),
      normalize: asIdentifier,
      passMessage: 'Purchase-order identifiers match.',
      failMessage: 'Invoice purchase-order identifier does not match the approved order.',
    }),
    exactRule({
      code: 'currency_match',
      leftLabel: 'purchase order',
      left: factOf(purchaseOrder, 'currency'),
      rightLabel: 'current invoice',
      right: factOf(current, 'currency'),
      normalize: asCurrency,
      passMessage: 'Currencies match.',
      failMessage: 'Invoice currency differs from the approved order.',
    }),
    exactRule({
      code: 'invoice_amount_matches_po',
      leftLabel: 'purchase order',
      left: factOf(purchaseOrder, 'amount'),
      rightLabel: 'current invoice',
      right: factOf(current, 'amount'),
      normalize: asMoney,
      passMessage: 'Invoice amount matches the approved purchase order.',
      failMessage: 'Invoice amount differs from the approved purchase order.',
    }),
    exactRule({
      code: 'beneficiary_name_match',
      leftLabel: 'vendor master',
      left: factOf(vendor, 'beneficiary_name'),
      rightLabel: 'current invoice',
      right: factOf(current, 'beneficiary_name'),
      normalize: asName,
      passMessage: 'Beneficiary names match.',
      failMessage: 'Invoice beneficiary name differs from the verified vendor record.',
    }),
    exactRule({
      code: 'bank_change_vendor_match',
      leftLabel: 'vendor master',
      left: factOf(vendor, 'vendor_id'),
      rightLabel: 'bank-change request',
      right: factOf(bankChange, 'vendor_id'),
      normalize: asIdentifier,
      passMessage: 'Bank-change request vendor matches the verified vendor record.',
      failMessage: 'Bank-change request vendor differs from the verified vendor record.',
    }),
    exactRule({
      code: 'bank_change_request_match',
      leftLabel: 'bank-change request',
      left: factOf(bankChange, 'iban'),
      rightLabel: 'current invoice',
      right: factOf(current, 'iban'),
      normalize: asIban,
      passMessage: 'Current invoice bank account matches the submitted bank-change request.',
      failMessage: 'Current invoice bank account differs from the submitted bank-change request.',
    }),
    bankContinuityRule(packet),
    confidenceRule(packet),
  ];
}
