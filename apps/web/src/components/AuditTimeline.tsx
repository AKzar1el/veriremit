import type { CaseStatus } from '@veriremit/domain';

export function AuditTimeline({ valid, status }: { valid: boolean | null; status: CaseStatus }) {
  const state = valid === null ? 'Not checked' : valid ? 'Hash chain verified' : 'Integrity failure';
  const className = valid === null ? 'audit-state' : valid ? 'audit-state good' : 'audit-state bad';
  return (
    <section className="panel audit-panel" aria-labelledby="audit-heading">
      <div className="panel-heading compact">
        <div>
          <p className="eyebrow">Tamper-evident ledger</p>
          <h2 id="audit-heading">Audit integrity</h2>
        </div>
        <span className={className}>{state}</span>
      </div>
      <p className="muted">
        Current state: <strong>{status.replaceAll('_', ' ')}</strong>. Release and signature operations re-check the ledger server-side before any provider call.
      </p>
    </section>
  );
}
