export const CANONICAL_DOCTAVIAN_VERIFIED_AT = '2026-09-01T12:00:00.000Z';

export function createCanonicalDoctavianReleaseData(verifiedAt: string): Readonly<Record<string, unknown>> {
  return {
    Release: {
      CaseId: 'case_acme_po_4821',
      Supplier: 'ACME Components GmbH',
      VendorId: 'V-1042',
      PoNumber: 'PO-4821',
      Amount: '48620.00',
      Currency: 'EUR',
      Beneficiary: 'ACME Components GmbH',
      Iban: 'DE72 5001 0517 5407',
      ReviewerName: 'Tomi Seregi',
      VerificationReference: 'VR-LIVE-4821',
      VerifiedAt: verifiedAt,
      Checks: [
        {
          Code: 'bank_account_continuity',
          Outcome: 'PASS',
          Summary: 'Independent trusted callback confirmed the requested account.',
        },
        {
          Code: 'human_verification',
          Outcome: 'PASS',
          Summary: 'Human verification is recorded before document generation.',
        },
      ],
    },
  };
}
