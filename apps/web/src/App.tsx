import { useEffect, useMemo, useState } from 'react';
import type { SourceRef, VerificationCase } from '@veriremit/domain';
import {
  ApiError,
  createViewerSession,
  getCase,
  loadOrCreateDemoCase,
  prepareRelease,
  recordTrustedCallback,
  refreshSignature,
  runCaseAgent,
  runExtraction,
  sendForSignature,
  verifyAudit,
} from './api.ts';
import { formatAgentOutput, suggestAgentPrompt } from './agent-prompt-model.ts';
import { AgentPromptPanel } from './components/AgentPromptPanel.tsx';
import { AuditTimeline } from './components/AuditTimeline.tsx';
import { ControlsPanel } from './components/ControlsPanel.tsx';
import { EvidencePanel } from './components/EvidencePanel.tsx';
import { ReviewPanel } from './components/ReviewPanel.tsx';
import { buildWorkbenchView } from './view-model.ts';

export default function App() {
  const [caseValue, setCaseValue] = useState<VerificationCase | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [auditValid, setAuditValid] = useState<boolean | null>(null);
  const [activeEvidence, setActiveEvidence] = useState<string | null>(null);
  const [agentPrompt, setAgentPrompt] = useState('');
  const [agentResponse, setAgentResponse] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadOrCreateDemoCase()
      .then((value) => { if (!cancelled) setCaseValue(value); })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : 'Could not load demo case.');
      });
    return () => { cancelled = true; };
  }, []);

  const view = useMemo(() => caseValue ? buildWorkbenchView(caseValue) : null, [caseValue]);

  useEffect(() => {
    if (!caseValue) return;
    setAgentPrompt(suggestAgentPrompt(caseValue.status));
  }, [caseValue?.status]);

  async function mutate(action: () => Promise<VerificationCase>) {
    setBusy(true);
    setError(null);
    try {
      const next = await action();
      setCaseValue(next);
      if (next.status !== 'created' && next.status !== 'extracting') {
        const audit = await verifyAudit(next.id);
        setAuditValid(audit.valid);
      }
    } catch (reason) {
      if (reason instanceof ApiError) {
        setError(`${reason.code}: ${reason.message}`);
      } else {
        setError(reason instanceof Error ? reason.message : 'Unexpected request failure.');
      }
    } finally {
      setBusy(false);
    }
  }

  async function openSource(source: SourceRef) {
    setError(null);
    try {
      const session = await createViewerSession(source.documentId);
      setActiveEvidence(
        `Scoped viewer ready for ${source.filename}, page ${source.page ?? '—'}${session.expiresAt ? ` · expires ${session.expiresAt}` : ''}`,
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not open source evidence.');
    }
  }

  async function runAgentPrompt() {
    if (!caseValue || !agentPrompt.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const result = await runCaseAgent(caseValue.id, agentPrompt.trim());
      setAgentResponse(formatAgentOutput(result.output));
      const next = await getCase(caseValue.id);
      setCaseValue(next);
      if (next.status !== 'created' && next.status !== 'extracting') {
        const audit = await verifyAudit(next.id);
        setAuditValid(audit.valid);
      }
    } catch (reason) {
      if (reason instanceof ApiError) {
        setError(`${reason.code}: ${reason.message}`);
      } else {
        setError(reason instanceof Error ? reason.message : 'Agent request failed.');
      }
    } finally {
      setBusy(false);
    }
  }

  if (!caseValue || !view) {
    return (
      <main className="loading-shell">
        <div className="brand-mark">VR</div>
        <p>{error ?? 'Loading synthetic verification case…'}</p>
      </main>
    );
  }

  const trustedSource = caseValue.documents
    .find((document) => document.kind === 'vendor_master')
    ?.facts.find((fact) => fact.field === 'trusted_phone')
    ?.source;

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-block">
          <div className="brand-mark">VR</div>
          <div>
            <strong>VeriRemit</strong>
            <span>Payment release verification</span>
          </div>
        </div>
        <div className="case-meta">
          {view.fixtureMode ? <span className="fixture-badge">DEMO FIXTURE MODE</span> : <span className="live-badge">LIVE PROVIDERS</span>}
          <span>{view.caseId}</span>
          <strong className={`status-pill status-${view.statusTone}`}>{view.status.replaceAll('_', ' ')}</strong>
        </div>
      </header>

      <section className="hero-strip">
        <div>
          <p className="eyebrow">Payment instruction</p>
          <h1>Review ACME Components · PO-4821</h1>
          <p>Prepare the €48,620 payment release only if the banking details are independently verified.</p>
        </div>
        <div className="guardrail-copy">
          <span>Policy</span>
          <strong>Changed bank account = hard block</strong>
          <small>AI may explain and prepare. It cannot authorize or sign.</small>
        </div>
      </section>

      <AgentPromptPanel
        status={caseValue.status}
        prompt={agentPrompt}
        response={agentResponse}
        busy={busy}
        onPromptChange={setAgentPrompt}
        onRun={runAgentPrompt}
      />

      {error ? <div className="error-banner" role="alert">{error}</div> : null}

      <div className="workbench-grid">
        <EvidencePanel
          documents={caseValue.documents}
          bankChange={view.bankChange}
          onOpenSource={(source) => void openSource(source)}
          activeEvidence={activeEvidence}
        />
        <ControlsPanel rules={view.controls} />
        <aside className="right-rail">
          <ReviewPanel
            trustedPhone={view.trustedPhone}
            signingUrl={view.signingUrl}
            actions={view.actions}
            busy={busy}
            onRunReview={() => mutate(() => runExtraction(caseValue.id))}
            onRecordReview={(reference, reviewerName) => {
              if (!trustedSource) return Promise.reject(new Error('Trusted vendor-master contact source is unavailable.'));
              return mutate(() => recordTrustedCallback({
                caseId: caseValue.id,
                trustedContactSource: trustedSource,
                reference,
                reviewerName,
                result: 'confirmed',
              }));
            }}
            onPrepareRelease={() => mutate(() => prepareRelease(caseValue.id))}
            onSendForSignature={() => mutate(() => sendForSignature(caseValue.id))}
            onRefreshSignature={() => mutate(() => refreshSignature(caseValue.id))}
          />
          <AuditTimeline valid={auditValid} status={caseValue.status} />
        </aside>
      </div>
    </main>
  );
}
