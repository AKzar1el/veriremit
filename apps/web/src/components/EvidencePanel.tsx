import type { ExtractedDocument, SourceRef } from '@veriremit/domain';
import type { BankChangeView } from '../view-model.ts';

interface EvidencePanelProps {
  documents: readonly ExtractedDocument[];
  bankChange: BankChangeView | null;
  activeEvidence: string | null;
  onOpenSource: (source: SourceRef) => void;
}

export function EvidencePanel({ documents, bankChange, activeEvidence, onOpenSource }: EvidencePanelProps) {
  return (
    <section className="panel" aria-labelledby="evidence-heading">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Source-grounded evidence</p>
          <h2 id="evidence-heading">Document packet</h2>
        </div>
        <span className="count-badge">{documents.length} files</span>
      </div>

      {bankChange ? (
        <div className="evidence-alert" role="alert">
          <p className="eyebrow">Hard block · bank account changed</p>
          <div className="iban-compare">
            <button type="button" onClick={() => onOpenSource(bankChange.oldSource)}>
              <span>Verified history</span>
              <strong>{bankChange.oldIban}</strong>
              <small>Open source</small>
            </button>
            <div className="arrow" aria-hidden="true">→</div>
            <button type="button" onClick={() => onOpenSource(bankChange.newSource)}>
              <span>Current invoice</span>
              <strong>{bankChange.newIban}</strong>
              <small>Open source</small>
            </button>
          </div>
          <p>{bankChange.message}</p>
        </div>
      ) : null}

      <div className="document-list">
        {documents.map((document) => (
          <div className="document-card" key={document.id}>
            <div>
              <strong>{document.filename}</strong>
              <p>{document.kind.replaceAll('_', ' ')}</p>
            </div>
            <span>{document.mode}</span>
          </div>
        ))}
      </div>

      <div className="viewer-placeholder" aria-live="polite">
        {activeEvidence ?? 'Select grounded evidence to request a short-lived, read-only Nutrient viewer session.'}
      </div>
    </section>
  );
}
