// Manager / team-lead dashboard: each member's CURRENT usage + load, plus the
// team-wide prioritized queue from the two-agent pipeline. No per-event history.

import { PriorityBadge, TierBadge, Bar, money, initials } from '../components/Bits.jsx';

function Stat({ label, value, sub, warn }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className={`stat-value ${warn ? 'warn' : ''}`}>{value}</div>
      {sub != null && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

export default function ManagerView({ data, onOpenMember }) {
  if (!data) return null;
  const { team, members, queue, codebasePresent, indexedFiles, budget } = data;

  return (
    <div className="view">
      {/* team summary */}
      <section className="stat-row">
        <Stat label="Team spend" value={money(team.spentUSD)} sub={`of ${money(budget.total)} ${budget.period}`} />
        <Stat label="Remaining" value={money(team.remainingUSD)} warn={team.remainingUSD < budget.total * 0.15} />
        <Stat label="Open recommendations" value={team.openRecommendations} />
        <Stat label="Over budget" value={team.overBudgetTickets} sub="tickets that don't fit" warn={team.overBudgetTickets > 0} />
        <Stat
          label="Codebase"
          value={codebasePresent ? `${indexedFiles} files` : 'not pasted'}
          sub={codebasePresent ? 'Agent 1 indexed' : 'text-only mode'}
          warn={!codebasePresent}
        />
      </section>

      {/* per-member usage cards */}
      <h2 className="section-title">Team members — usage &amp; load</h2>
      <section className="member-grid">
        {members.map((m) => (
          <button key={m.id} className="member-card" onClick={() => onOpenMember(m.id)}>
            <div className="member-head">
              <span className="avatar">{initials(m.name)}</span>
              <div>
                <div className="member-name">{m.name}</div>
                <div className="member-role">{m.role}</div>
              </div>
              <span className="open-hint">view →</span>
            </div>

            <div className="member-budget">
              <div className="member-budget-figures">
                <span>{money(m.spentUSD)}</span>
                <span className="muted"> / {money(m.weeklyBudgetUSD)}</span>
                <span className="muted"> · {m.budgetUsedPct}%</span>
              </div>
              <Bar pct={m.budgetUsedPct} warn={m.budgetUsedPct >= 85} />
            </div>

            <div className="member-metrics">
              <div><span className="muted">worked</span> {m.ticketsWorked}</div>
              <div><span className="muted">assigned</span> {m.assignedCount}</div>
              <div><span className="muted">queued</span> {money(m.assignedCostUSD)} · {m.assignedHours}h</div>
            </div>

            {m.topRecommendation && (
              <div className="member-top">
                <PriorityBadge priority={m.topRecommendation.priority} />
                <span className="member-top-title">{m.topRecommendation.title}</span>
              </div>
            )}
          </button>
        ))}
      </section>

      {/* team-wide prioritized queue */}
      <h2 className="section-title">Recommended work order <span className="muted">(Agent 2)</span></h2>
      <section className="queue">
        <div className="queue-row queue-head">
          <span>#</span><span>Ticket</span><span>Pri</span><span>Model</span>
          <span>Cost</span><span>Effort</span><span>Assignee</span><span>Fit</span>
        </div>
        {queue.map((r) => (
          <div key={r.ticketId} className={`queue-row ${r.fitsBudget ? '' : 'over'}`}>
            <span className="rank">{r.priorityRank}</span>
            <span className="q-title">
              <span className="q-id">{r.ticketId}</span> {r.title}
            </span>
            <span><PriorityBadge priority={r.priority} /></span>
            <span><TierBadge tier={r.recommendedModelTier} /></span>
            <span>{money(r.estimatedCostUSD)}</span>
            <span>{r.estimatedEffortHours}h</span>
            <span className="q-assignee">{r.assignee?.name || '—'}</span>
            <span>{r.fitsBudget ? '✓' : '⚠'}</span>
          </div>
        ))}
      </section>
    </div>
  );
}
