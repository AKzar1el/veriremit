import { useState } from 'react';
import type { WorkbenchActions } from '../view-model.ts';

interface ReviewPanelProps {
  trustedPhone: string | null;
  signingUrl: string | null;
  actions: WorkbenchActions;
  busy: boolean;
  onRunReview: () => void;
  onRecordReview: (reference: string, reviewerName: string) => Promise<void>;
  onPrepareRelease: () => void;
  onSendForSignature: () => void;
  onRefreshSignature: () => void;
}

export function ReviewPanel({
  trustedPhone,
  signingUrl,
  actions,
  busy,
  onRunReview,
  onRecordReview,
  onPrepareRelease,
  onSendForSignature,
  onRefreshSignature,
}: ReviewPanelProps) {
  const [reference, setReference] = useState('VR-2026-4821');
  const [reviewerName, setReviewerName] = useState('Demo Finance Controller');

  return (
    <section className="panel action-panel" aria-labelledby="review-heading">
      <div className="panel-heading compact">
        <div>
          <p className="eyebrow">Human boundary</p>
          <h2 id="review-heading">Release control</h2>
        </div>
      </div>

      {actions.recordReview ? (
        <form
          className="review-form"
          onSubmit={(event) => {
            event.preventDefault();
            void onRecordReview(reference.trim(), reviewerName.trim());
          }}
        >
          <div className="trusted-channel">
            <span>Call only the pre-existing vendor-master contact</span>
            <strong>{trustedPhone ?? 'Trusted contact unavailable'}</strong>
            <small>The suspicious change letter cannot supply this verification channel.</small>
          </div>
          <label>
            Verification reference
            <input
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              required
              minLength={3}
              disabled={busy}
            />
          </label>
          <label>
            Reviewer
            <input
              value={reviewerName}
              onChange={(event) => setReviewerName(event.target.value)}
              required
              minLength={3}
              disabled={busy}
            />
          </label>
          <button className="primary-action" type="submit" disabled={busy || !trustedPhone}>
            Record independent verification
          </button>
        </form>
      ) : null}

      {actions.runReview ? (
        <button className="primary-action" type="button" onClick={onRunReview} disabled={busy}>
          Review document packet
        </button>
      ) : null}
      {actions.prepareRelease ? (
        <button className="primary-action" type="button" onClick={onPrepareRelease} disabled={busy}>
          Prepare release packet with Foxit MCP
        </button>
      ) : null}
      {actions.sendForSignature ? (
        <button className="primary-action" type="button" onClick={onSendForSignature} disabled={busy}>
          Send to human signer
        </button>
      ) : null}
      {actions.refreshSignature ? (
        <>
          {signingUrl ? (
            <a
              className="primary-action signing-link"
              href={signingUrl}
              target="_blank"
              rel="noreferrer"
            >
              Open Foxit human signing session
            </a>
          ) : null}
          <button className="secondary-action" type="button" onClick={onRefreshSignature} disabled={busy}>
            Refresh authoritative signature status
          </button>
        </>
      ) : null}

      {!Object.values(actions).some(Boolean) ? (
        <p className="muted">No consequential action is available in the current authoritative case state.</p>
      ) : null}
    </section>
  );
}
