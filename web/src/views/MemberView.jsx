// Member dashboard: this member's usage, their Agent-2 recommendations (with a
// "Work" action), and their full history of worked tickets.

import { PriorityBadge, TierBadge, Bar, money, tokensFmt, timeAgo, initials } from '../components/Bits.jsx';

function Stat({ label, value, sub, warn }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className={`stat-value ${warn ? 'warn' : ''}`}>{value}</div>
      {sub != null && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

export default function MemberView({ data, onWork, working }) {
  if (!data) return null;
  const { member, usage, recommendations, history } = data;

  return (
    <div className="view">
      <div className="member-banner">
        <span className="avatar lg">{initials(member.name)}</span>
        <div>
          <div className="member-name lg">{member.name}</div>
          <div className="member-role">{member.role} · {member.id}</div>
        </div>
      </div>

      {/* usage */}
      <section className="stat-row">
        <Stat label="Spent this period" value={money(usage.spentUSD)} sub={`of ${money(usage.weeklyBudgetUSD)} · ${usage.budgetUsedPct}%`} warn={usage.budgetUsedPct >= 85} />
        <Stat label="Tickets worked" value={usage.ticketsWorked} />
        <Stat label="Tokens used" value={tokensFmt(usage.tokens)} />
        <Stat label="Last active" value={timeAgo(usage.lastActiveTs)} />
      </section>
      <div className="member-budget wide">
        <Bar pct={usage.budgetUsedPct} warn={usage.budgetUsedPct >= 85} />
      </div>

      {/* recommendations */}
      <h2 className="section-title">Recommended for you <span className="muted">(priority · cost · effort)</span></h2>
      <section className="rec-list">
        {recommendations.length === 0 && <div className="empty">No recommendations assigned right now.</div>}
        {recommendations.map((r) => (
          <div key={r.ticketId} className={`rec ${r.fitsBudget ? '' : 'over'}`}>
            <div className="rec-rank">#{r.priorityRank}</div>
            <div className="rec-main">
              <div className="rec-title-row">
                <PriorityBadge priority={r.priority} />
                <span className="rec-id">{r.ticketId}</span>
                <span className="rec-title">{r.title}</span>
                <TierBadge tier={r.recommendedModelTier} />
              </div>
              <div className="rec-meta">
                <span><strong>{money(r.estimatedCostUSD)}</strong> est. cost</span>
                <span><strong>{r.estimatedEffortHours}h</strong> effort</span>
                <span><strong>{tokensFmt(r.estimatedTokens)}</strong> tokens</span>
                <span>{r.intel.surface} surface{r.intel.relatedFiles.length ? ` · ${r.intel.relatedFiles.length} files` : ''}</span>
              </div>
              <div className="rec-why">{r.rationale}</div>
            </div>
            <button className="work-btn" disabled={working === r.ticketId} onClick={() => onWork(r.ticketId)}>
              {working === r.ticketId ? 'Working…' : 'Work →'}
            </button>
          </div>
        ))}
      </section>

      {/* history */}
      <h2 className="section-title">History <span className="muted">({history.length} worked)</span></h2>
      <section className="queue">
        <div className="queue-row hist-head">
          <span>Ticket</span><span>Pri</span><span>Model</span><span>Cost</span><span>Tokens</span><span>Effort</span><span>When</span>
        </div>
        {history.length === 0 && <div className="empty">Nothing worked yet.</div>}
        {history.map((h, i) => (
          <div key={`${h.ticketId}-${i}`} className="queue-row hist">
            <span className="q-title"><span className="q-id">{h.ticketId}</span> {h.title}</span>
            <span><PriorityBadge priority={h.priority} /></span>
            <span><TierBadge tier={h.tier} /></span>
            <span>{money(h.costUSD)}</span>
            <span>{tokensFmt(h.tokens)}</span>
            <span>{h.effortHours}h</span>
            <span className="muted">{timeAgo(h.ts)}</span>
          </div>
        ))}
      </section>
    </div>
  );
}
