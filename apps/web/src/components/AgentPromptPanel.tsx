import type { FormEvent } from 'react';
import type { CaseStatus } from '@veriremit/domain';

interface AgentPromptPanelProps {
  status: CaseStatus;
  prompt: string;
  response: string | null;
  busy: boolean;
  onPromptChange(value: string): void;
  onRun(): Promise<void> | void;
}

export function AgentPromptPanel({
  status,
  prompt,
  response,
  busy,
  onPromptChange,
  onRun,
}: AgentPromptPanelProps) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!prompt.trim() || busy) return;
    void onRun();
  }

  return (
    <section className="agent-prompt-panel" aria-label="Bounded document agent">
      <div className="agent-prompt-heading">
        <div>
          <p className="eyebrow">Plain-language agent request</p>
          <h2>Ask VeriRemit to review or continue this case</h2>
        </div>
        <div className="agent-boundary-badge">
          <strong>Bounded agent</strong>
          <span>read · extract · prepare · request human signature</span>
        </div>
      </div>

      <form className="agent-prompt-form" onSubmit={submit}>
        <label htmlFor="agent-prompt">Agent prompt</label>
        <textarea
          id="agent-prompt"
          value={prompt}
          maxLength={1200}
          rows={3}
          disabled={busy}
          onChange={(event) => onPromptChange(event.target.value)}
        />
        <div className="agent-prompt-actions">
          <small>
            Case state: <strong>{status.replaceAll('_', ' ')}</strong>. The agent may request a gated human eSign envelope, but it cannot sign, approve verification, authorize payment, or override deterministic policy.
          </small>
          <button className="primary-action agent-run-button" type="submit" disabled={busy || !prompt.trim()}>
            {busy ? 'Running bounded agent…' : 'Run bounded agent'}
          </button>
        </div>
      </form>

      {response ? (
        <div className="agent-response" role="status" aria-live="polite">
          <span>Agent response</span>
          <p>{response}</p>
        </div>
      ) : null}
    </section>
  );
}
