import type { RuleResult } from '@veriremit/domain';

export function ControlsPanel({ rules }: { rules: readonly RuleResult[] }) {
  return (
    <section className="panel" aria-labelledby="controls-heading">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Deterministic policy</p>
          <h2 id="controls-heading">Verification controls</h2>
        </div>
        <span className="count-badge">{rules.length} checks</span>
      </div>
      <div className="control-list">
        {rules.length === 0 ? (
          <p className="muted">Run document review to evaluate the verification controls.</p>
        ) : rules.map((rule) => (
          <div className="control-row" key={rule.code}>
            <div>
              <strong>{rule.code.replaceAll('_', ' ')}</strong>
              <p>{rule.message}</p>
            </div>
            <span className={`control-outcome control-${rule.outcome.toLowerCase()}`}>{rule.outcome}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
